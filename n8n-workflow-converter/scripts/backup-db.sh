#!/bin/bash

# Database backup script for n8n Workflow Converter
# This script creates automated backups of the PostgreSQL database

set -e

# Configuration
POSTGRES_HOST=${POSTGRES_HOST:-postgres}
POSTGRES_PORT=${POSTGRES_PORT:-5432}
POSTGRES_DB=${POSTGRES_DB:-n8n_converter}
POSTGRES_USER=${POSTGRES_USER:-postgres}
BACKUP_DIR=${BACKUP_DIR:-/backups}
RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-7}
COMPRESSION=${BACKUP_COMPRESSION:-gzip}

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Generate timestamp
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/backup_${POSTGRES_DB}_${TIMESTAMP}.sql"

echo "Starting database backup at $(date)"
echo "Database: $POSTGRES_DB"
echo "Host: $POSTGRES_HOST:$POSTGRES_PORT"
echo "Backup file: $BACKUP_FILE"

# Wait for database to be ready
echo "Waiting for database to be ready..."
until pg_isready -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER"; do
    echo "Database is not ready yet. Waiting..."
    sleep 5
done

echo "Database is ready. Starting backup..."

# Create backup
if pg_dump -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
    --verbose \
    --no-password \
    --format=custom \
    --compress=9 \
    --file="$BACKUP_FILE.custom"; then
    
    echo "Custom format backup completed successfully"
    
    # Also create plain SQL backup for easier restoration
    if pg_dump -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
        --verbose \
        --no-password \
        --format=plain \
        --file="$BACKUP_FILE"; then
        
        echo "Plain SQL backup completed successfully"
        
        # Compress the plain SQL backup
        if [ "$COMPRESSION" = "gzip" ]; then
            gzip "$BACKUP_FILE"
            BACKUP_FILE="${BACKUP_FILE}.gz"
            echo "Backup compressed with gzip"
        elif [ "$COMPRESSION" = "bzip2" ]; then
            bzip2 "$BACKUP_FILE"
            BACKUP_FILE="${BACKUP_FILE}.bz2"
            echo "Backup compressed with bzip2"
        fi
        
    else
        echo "ERROR: Plain SQL backup failed"
        exit 1
    fi
    
else
    echo "ERROR: Custom format backup failed"
    exit 1
fi

# Verify backup integrity
echo "Verifying backup integrity..."
if [ "$COMPRESSION" = "gzip" ]; then
    if gzip -t "$BACKUP_FILE"; then
        echo "Backup integrity verified (gzip)"
    else
        echo "ERROR: Backup integrity check failed (gzip)"
        exit 1
    fi
elif [ "$COMPRESSION" = "bzip2" ]; then
    if bzip2 -t "$BACKUP_FILE"; then
        echo "Backup integrity verified (bzip2)"
    else
        echo "ERROR: Backup integrity check failed (bzip2)"
        exit 1
    fi
fi

# Get backup size
BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
CUSTOM_SIZE=$(du -h "$BACKUP_FILE.custom" | cut -f1)

echo "Backup completed successfully!"
echo "Plain SQL backup size: $BACKUP_SIZE"
echo "Custom backup size: $CUSTOM_SIZE"

# Clean up old backups
echo "Cleaning up backups older than $RETENTION_DAYS days..."
find "$BACKUP_DIR" -name "backup_${POSTGRES_DB}_*.sql*" -type f -mtime +$RETENTION_DAYS -delete
find "$BACKUP_DIR" -name "backup_${POSTGRES_DB}_*.custom" -type f -mtime +$RETENTION_DAYS -delete

# Count remaining backups
BACKUP_COUNT=$(find "$BACKUP_DIR" -name "backup_${POSTGRES_DB}_*.sql*" -type f | wc -l)
echo "Cleanup completed. $BACKUP_COUNT backups remaining."

# Create backup manifest
MANIFEST_FILE="$BACKUP_DIR/backup_manifest.json"
cat > "$MANIFEST_FILE" << EOF
{
  "timestamp": "$(date -Iseconds)",
  "database": "$POSTGRES_DB",
  "host": "$POSTGRES_HOST",
  "port": $POSTGRES_PORT,
  "backup_files": {
    "plain_sql": "$(basename "$BACKUP_FILE")",
    "custom": "$(basename "$BACKUP_FILE.custom")"
  },
  "sizes": {
    "plain_sql": "$BACKUP_SIZE",
    "custom": "$CUSTOM_SIZE"
  },
  "retention_days": $RETENTION_DAYS,
  "total_backups": $BACKUP_COUNT
}
EOF

echo "Backup manifest created: $MANIFEST_FILE"

# Optional: Upload to cloud storage (uncomment and configure as needed)
# if [ -n "$AWS_S3_BUCKET" ]; then
#     echo "Uploading backup to S3..."
#     aws s3 cp "$BACKUP_FILE" "s3://$AWS_S3_BUCKET/backups/"
#     aws s3 cp "$BACKUP_FILE.custom" "s3://$AWS_S3_BUCKET/backups/"
#     echo "Backup uploaded to S3"
# fi

# Optional: Send notification (uncomment and configure as needed)
# if [ -n "$WEBHOOK_URL" ]; then
#     curl -X POST "$WEBHOOK_URL" \
#         -H "Content-Type: application/json" \
#         -d "{\"text\":\"Database backup completed successfully. Size: $BACKUP_SIZE\"}"
# fi

echo "Backup process completed at $(date)"
exit 0