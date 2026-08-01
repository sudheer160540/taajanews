const { BlobServiceClient, generateBlobSASQueryParameters, BlobSASPermissions, StorageSharedKeyCredential } = require('@azure/storage-blob');

// Parse connection string to extract account details
const parseConnectionString = (connectionString) => {
  const parts = connectionString.split(';');
  const config = {};
  
  parts.forEach(part => {
    const [key, ...valueParts] = part.split('=');
    config[key] = valueParts.join('=');
  });
  
  return config;
};

const connectionConfig = parseConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING || '');

// Create blob service client
const blobServiceClient = BlobServiceClient.fromConnectionString(
  process.env.AZURE_STORAGE_CONNECTION_STRING || ''
);

const containerClient = blobServiceClient.getContainerClient(
  process.env.AZURE_STORAGE_CONTAINER || 'patientprescription'
);

const audioContainerClient = blobServiceClient.getContainerClient(
  process.env.AZURE_STORAGE_AUDIO_CONTAINER || 'audio'
);

// Generate SAS token for blob operations
const generateSASToken = (blobName, permissions = 'rcw', expiresInMinutes = 30) => {
  const accountName = connectionConfig.AccountName;
  const accountKey = connectionConfig.AccountKey;
  
  if (!accountName || !accountKey) {
    throw new Error('Azure Storage credentials not configured');
  }
  
  const sharedKeyCredential = new StorageSharedKeyCredential(accountName, accountKey);
  
  const startsOn = new Date();
  const expiresOn = new Date(startsOn.getTime() + expiresInMinutes * 60 * 1000);
  
  const sasOptions = {
    containerName: process.env.AZURE_STORAGE_CONTAINER || 'patientprescription',
    blobName,
    permissions: BlobSASPermissions.parse(permissions),
    startsOn,
    expiresOn,
    protocol: 'https'
  };
  
  const sasToken = generateBlobSASQueryParameters(sasOptions, sharedKeyCredential).toString();
  
  return {
    sasToken,
    blobUrl: `${process.env.AZURE_STORAGE_URL}/${process.env.AZURE_STORAGE_CONTAINER}/${blobName}`,
    fullUrl: `${process.env.AZURE_STORAGE_URL}/${process.env.AZURE_STORAGE_CONTAINER}/${blobName}?${sasToken}`,
    expiresOn
  };
};

// Generate upload URL with write permission
const getUploadUrl = (filename) => {
  const blobName = `${Date.now()}-${filename}`;
  return generateSASToken(blobName, 'cw', 30); // Create and Write permissions
};

// Generate read URL
const getReadUrl = (blobName, expiresInMinutes = 60) => {
  return generateSASToken(blobName, 'r', expiresInMinutes); // Read permission only
};

// Delete blob from default images container
const deleteBlob = async (blobName, containerName) => {
  try {
    const imagesContainer = process.env.AZURE_STORAGE_CONTAINER || 'images';
    const audioContainer = process.env.AZURE_STORAGE_AUDIO_CONTAINER || 'audio';
    const client = containerName === audioContainer
      ? audioContainerClient
      : containerClient;
    const blockBlobClient = client.getBlockBlobClient(blobName);
    await blockBlobClient.deleteIfExists();
    return true;
  } catch (error) {
    console.error('Error deleting blob:', error);
    return false;
  }
};

/** Delete a blob given its full Azure URL (images or audio container). */
const deleteBlobFromUrl = async (blobUrl) => {
  const parsed = parseAzureBlobUrl(blobUrl);
  if (!parsed) return false;
  return deleteBlob(parsed.blobName, parsed.container);
};

const parseAzureBlobUrl = (blobUrl) => {
  const baseUrl = (process.env.AZURE_STORAGE_URL || '').replace(/\/$/, '');
  if (!blobUrl || typeof blobUrl !== 'string' || !baseUrl) return null;

  try {
    const url = new URL(blobUrl.split('?')[0]);
    if (!url.href.startsWith(baseUrl)) return null;

    const parts = url.pathname.split('/').filter(Boolean);
    if (parts.length < 2) return null;

    const imagesContainer = process.env.AZURE_STORAGE_CONTAINER || 'images';
    const audioContainer = process.env.AZURE_STORAGE_AUDIO_CONTAINER || 'audio';
    const container = parts[0];
    if (![imagesContainer, audioContainer].includes(container)) return null;

    return { container, blobName: parts.slice(1).join('/') };
  } catch {
    return null;
  }
};

module.exports = {
  blobServiceClient,
  containerClient,
  audioContainerClient,
  generateSASToken,
  getUploadUrl,
  getReadUrl,
  deleteBlob,
  deleteBlobFromUrl,
  parseAzureBlobUrl
};
