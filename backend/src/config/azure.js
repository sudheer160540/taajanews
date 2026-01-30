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

// Delete blob
const deleteBlob = async (blobName) => {
  try {
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);
    await blockBlobClient.delete();
    return true;
  } catch (error) {
    console.error('Error deleting blob:', error);
    return false;
  }
};

module.exports = {
  blobServiceClient,
  containerClient,
  generateSASToken,
  getUploadUrl,
  getReadUrl,
  deleteBlob
};
