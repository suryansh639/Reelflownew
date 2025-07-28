# TikTok-Style Video Platform - Production Deployment Guide

## Overview

This guide covers deploying the TikTok-style video sharing platform to production using Docker Compose with PostgreSQL database and AWS S3 storage.

## Prerequisites

Before deploying, ensure you have:

1. **Docker and Docker Compose** installed on your server
2. **AWS Account** with S3 bucket configured
3. **Domain name** (optional, but recommended for production)
4. **SSL certificate** (recommended for HTTPS)

## Environment Configuration

### 1. Create Environment File

Create a `.env` file in your project root with the following variables:

```bash
# Database Configuration
DATABASE_URL=postgresql://postgres:your_db_password@db:5432/tiktok_app
POSTGRES_PASSWORD=your_secure_database_password

# AWS S3 Configuration
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_REGION=us-east-1
S3_BUCKET_NAME=your-s3-bucket-name
CLOUDFRONT_DOMAIN=your-cloudfront-domain.cloudfront.net

# AI Services for Educational Content Validation
DEEPGRAM_API_KEY=your_deepgram_api_key
GEMINI_API_KEY=your_gemini_api_key

# Application
NODE_ENV=production
PORT=5000
```

### 2. AWS S3 Setup

#### Create S3 Bucket
```bash
# Using AWS CLI
aws s3 mb s3://your-bucket-name --region us-east-1
```

#### Configure S3 Bucket Policy
```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "PublicReadGetObject",
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::your-bucket-name/videos/*"
        }
    ]
}
```

#### Configure CORS for S3
```json
[
    {
        "AllowedHeaders": ["*"],
        "AllowedMethods": ["GET", "PUT", "POST"],
        "AllowedOrigins": ["https://your-domain.com"],
        "ExposeHeaders": []
    }
]
```

#### Set up CloudFront (Optional but Recommended)
1. Create CloudFront distribution with S3 as origin
2. Configure custom domain and SSL certificate
3. Update `CLOUDFRONT_DOMAIN` in environment variables

### 3. Update Docker Compose for Production

Create `docker-compose.prod.yml`:

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "80:5000"
      - "443:5000"  # If using SSL
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://postgres:${POSTGRES_PASSWORD}@db:5432/tiktok_app
      - DEEPGRAM_API_KEY=${DEEPGRAM_API_KEY}
      - GEMINI_API_KEY=${GEMINI_API_KEY}
      - AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID}
      - AWS_SECRET_ACCESS_KEY=${AWS_SECRET_ACCESS_KEY}
      - AWS_REGION=${AWS_REGION}
      - S3_BUCKET_NAME=${S3_BUCKET_NAME}
      - CLOUDFRONT_DOMAIN=${CLOUDFRONT_DOMAIN}
    depends_on:
      db:
        condition: service_healthy
    networks:
      - tiktok-network
    restart: unless-stopped
    volumes:
      - /etc/letsencrypt:/etc/letsencrypt:ro  # SSL certificates

  db:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=tiktok_app
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql
      - ./backups:/backups  # Database backups
    networks:
      - tiktok-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

volumes:
  postgres_data:

networks:
  tiktok-network:
    driver: bridge
```

## Deployment Steps

### 1. Server Preparation

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo apt install docker-compose-plugin
```

### 2. Deploy Application

```bash
# Clone your repository
git clone https://github.com/your-username/tiktok-app.git
cd tiktok-app

# Create and configure .env file
cp .env.example .env
nano .env  # Edit with your actual values

# Build and start services
docker-compose -f docker-compose.prod.yml up -d --build

# Check logs
docker-compose -f docker-compose.prod.yml logs -f
```

### 3. Database Migration

```bash
# Run database migrations
docker-compose -f docker-compose.prod.yml exec app npm run db:push

# Optional: Sync existing S3 videos
curl -X POST http://localhost/api/admin/sync-s3-videos \
  -H "Content-Type: application/json" \
  -H "Cookie: your-session-cookie"
```

### 4. SSL Configuration (Recommended)

#### Using Nginx Reverse Proxy with Let's Encrypt

Create `nginx.conf`:
```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

#### Generate SSL Certificate
```bash
sudo apt install certbot
sudo certbot certonly --standalone -d your-domain.com
```

## Monitoring and Maintenance

### Health Checks

The application includes built-in health checks:
```bash
# Check application health
curl http://localhost:5000/api/videos

# Check Docker container status
docker-compose -f docker-compose.prod.yml ps
```

### Database Backups

```bash
# Create backup script
cat > backup.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
docker-compose -f docker-compose.prod.yml exec -T db pg_dump -U postgres tiktok_app > ./backups/backup_$DATE.sql
EOF

chmod +x backup.sh

# Run daily via cron
(crontab -l 2>/dev/null; echo "0 2 * * * /path/to/your/app/backup.sh") | crontab -
```

### Log Management

```bash
# View application logs
docker-compose -f docker-compose.prod.yml logs app

# View database logs
docker-compose -f docker-compose.prod.yml logs db

# Set up log rotation
sudo nano /etc/logrotate.d/docker-compose
```

### Scaling (Optional)

For high traffic, consider:

1. **Load Balancer**: Use Nginx or AWS ALB
2. **Multiple App Instances**: Scale horizontally
3. **CDN**: Use CloudFront for video delivery
4. **Database**: Consider read replicas
5. **Session Store**: Use Redis for shared sessions

```yaml
# Scale app instances
services:
  app:
    deploy:
      replicas: 3
```

## Security Checklist

- [ ] Strong database passwords
- [ ] Secure session secret (32+ characters)
- [ ] SSL/HTTPS enabled
- [ ] Firewall configured (ports 80, 443 only)
- [ ] Regular security updates
- [ ] S3 bucket permissions properly configured
- [ ] Environment variables secured
- [ ] Database backups automated
- [ ] Monitoring and alerts set up

## Troubleshooting

### Common Issues

1. **Videos not loading**
   - Check S3 bucket permissions
   - Verify CORS configuration
   - Check AWS credentials

2. **Database connection errors**
   - Verify DATABASE_URL format
   - Check PostgreSQL service status
   - Review network connectivity

3. **AI service issues**
   - Verify DEEPGRAM_API_KEY and GEMINI_API_KEY are set
   - Check educational content validation pipeline
   - Review API service status

### Support Commands

```bash
# Restart services
docker-compose -f docker-compose.prod.yml restart

# View detailed logs
docker-compose -f docker-compose.prod.yml logs -f --tail=100

# Access database directly
docker-compose -f docker-compose.prod.yml exec db psql -U postgres tiktok_app

# Check disk usage
docker system df
docker system prune -a  # Clean up unused containers/images
```

## Performance Optimization

1. **Enable PostgreSQL connection pooling**
2. **Configure CDN for video delivery**
3. **Implement video compression**
4. **Add database indexes**
5. **Enable gzip compression**
6. **Optimize Docker images**

For production-grade deployment, consider using orchestration platforms like Kubernetes or AWS ECS for better scalability and management.