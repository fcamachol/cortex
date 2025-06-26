# Google Cloud Storage Setup Guide for WhatsApp Media

This guide will help you set up Google Cloud Storage for reliable media file storage in your deployed WhatsApp CRM system.

## 1. Create Google Cloud Storage Bucket

### Prerequisites
- Google Cloud Project with billing enabled
- GCS API enabled

### Steps

1. **Enable Cloud Storage API**
   ```bash
   gcloud services enable storage.googleapis.com
   ```

2. **Create Storage Bucket**
   ```bash
   gsutil mb -p YOUR_PROJECT_ID -c STANDARD -l us-central1 gs://whatsapp-media-storage-YOUR-SUFFIX
   ```

3. **Set Bucket Permissions for Public Access**
   ```bash
   gsutil iam ch allUsers:objectViewer gs://whatsapp-media-storage-YOUR-SUFFIX
   ```

## 2. Create Service Account

1. **Create Service Account**
   ```bash
   gcloud iam service-accounts create whatsapp-media-storage \
     --description="Service account for WhatsApp media storage" \
     --display-name="WhatsApp Media Storage"
   ```

2. **Grant Storage Admin Role**
   ```bash
   gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
     --member="serviceAccount:whatsapp-media-storage@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
     --role="roles/storage.admin"
   ```

3. **Create and Download Service Account Key**
   ```bash
   gcloud iam service-accounts keys create ~/whatsapp-media-key.json \
     --iam-account=whatsapp-media-storage@YOUR_PROJECT_ID.iam.gserviceaccount.com
   ```

## 3. Configure Environment Variables

Add these environment variables to your Replit deployment:

```bash
# Enable Google Cloud Storage
ENABLE_GCS_STORAGE=true

# Google Cloud Project Configuration
GCP_PROJECT_ID=your-project-id
GCS_BUCKET_NAME=whatsapp-media-storage-your-suffix

# Service Account Authentication (Choose one method)

# Method 1: Service Account Key File Path
GCP_SERVICE_ACCOUNT_KEY_PATH=/path/to/whatsapp-media-key.json

# Method 2: Service Account Key JSON (Base64 encoded for Replit secrets)
GCP_SERVICE_ACCOUNT_KEY='{"type":"service_account","project_id":"...}'
```

## 4. Deploy Configuration

### For Replit Deployment

1. **Add Secrets in Replit**
   - Go to your Replit project
   - Click on "Secrets" tab
   - Add the environment variables above

2. **Upload Service Account Key**
   - Option A: Upload the JSON file and set `GCP_SERVICE_ACCOUNT_KEY_PATH`
   - Option B: Copy the JSON content and set as `GCP_SERVICE_ACCOUNT_KEY` secret

## 5. Initialize and Migrate

### API Endpoints Available

1. **Check GCS Status**
   ```bash
   GET /api/admin/gcs/status
   ```

2. **Initialize GCS Bucket**
   ```bash
   POST /api/admin/gcs/initialize
   ```

3. **Migrate Existing Files**
   ```bash
   POST /api/admin/gcs/migrate
   {
     "localMediaDir": "/path/to/media" # optional, defaults to ./media
   }
   ```

### Migration Process

1. **Check Current Status**
   ```javascript
   const response = await fetch('/api/admin/gcs/status');
   const status = await response.json();
   console.log('GCS Status:', status);
   ```

2. **Initialize Bucket**
   ```javascript
   const response = await fetch('/api/admin/gcs/initialize', {
     method: 'POST'
   });
   const result = await response.json();
   console.log('Initialization:', result);
   ```

3. **Start Migration**
   ```javascript
   const response = await fetch('/api/admin/gcs/migrate', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({})
   });
   const result = await response.json();
   console.log('Migration Results:', result);
   ```

## 6. How It Works

### Hybrid Storage System
- **New Media**: Automatically uploaded to GCS when received
- **Existing Media**: Served from local storage until migrated
- **Media Serving**: 
  - Cloud URLs redirected for better performance
  - Local files served as fallback

### File Organization
```
Google Cloud Storage Bucket:
├── media/
│   ├── instance-1750433520122/
│   │   ├── messageId1.ogg
│   │   ├── messageId2.jpg
│   │   └── messageId3.pdf
│   ├── live-test-1750199771/
│   │   ├── messageId4.ogg
│   │   └── messageId5.jpg
│   └── other-instances/
```

### Database Integration
- `file_local_path`: Local file path (fallback)
- `file_url`: Cloud storage public URL (preferred)
- Media endpoint checks cloud URL first, then falls back to local

## 7. Benefits

✅ **Reliability**: No file loss during server restarts  
✅ **Performance**: Global CDN delivery through Google Cloud  
✅ **Scalability**: Unlimited storage capacity  
✅ **Cost-Effective**: Pay-as-you-use pricing  
✅ **Backup**: Automatic redundancy and durability  
✅ **Global Access**: Files accessible from anywhere  

## 8. Troubleshooting

### Common Issues

1. **Authentication Errors**
   - Verify service account key is valid
   - Check project ID matches
   - Ensure Storage API is enabled

2. **Permission Errors**
   - Verify service account has Storage Admin role
   - Check bucket permissions for public access

3. **Migration Failures**
   - Check local file paths exist
   - Verify network connectivity
   - Monitor API quotas

### Testing

```bash
# Test bucket access
curl "https://storage.googleapis.com/YOUR_BUCKET_NAME/media/test.txt"

# Test media endpoint
curl "https://your-app.replit.dev/api/admin/gcs/status"
```

## 9. Monitoring

### Key Metrics to Monitor
- Upload success rate
- File access patterns  
- Storage costs
- API quotas usage

### Logs to Watch
- `☁️ Media uploaded to cloud` - Successful uploads
- `⚠️ Cloud upload failed` - Upload failures  
- `☁️ Redirecting to cloud storage` - Cloud serving

This setup provides enterprise-grade media reliability for your WhatsApp CRM system.