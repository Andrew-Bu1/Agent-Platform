ALTER TABLE datasources
ADD COLUMN tenant_id UUID,
ADD COLUMN created_by_user_id UUID;

ALTER TABLE documents
ADD COLUMN tenant_id UUID,
ADD COLUMN uploaded_by_user_id UUID;

ALTER TABLE ingestions
ADD COLUMN tenant_id UUID,
ADD COLUMN created_by_user_id UUID;

ALTER TABLE chunks
ADD COLUMN tenant_id UUID,
ADD COLUMN document_id UUID;

ALTER TABLE chunk_384dimension
ADD COLUMN tenant_id UUID;

ALTER TABLE chunk_768dimension
ADD COLUMN tenant_id UUID;

ALTER TABLE chunk_1024dimension
ADD COLUMN tenant_id UUID;