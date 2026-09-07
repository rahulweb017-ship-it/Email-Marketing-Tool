import api from './client';

export const validateContact = (contactId: string) =>
  api.post(`/contacts/${contactId}/validate`);

export const bulkValidateContacts = (contactIds: string[]) =>
  api.post('/contacts/validate-bulk', { contact_ids: contactIds });
