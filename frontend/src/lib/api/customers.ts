import { requestJson, type PageResult } from "./client";

export type Customer = {
  id: string;
  legalName: string;
  taxId: string;
  hasCr: boolean;
  crNumber?: string | null;
  crExpiresAt?: string | null;
  authorizedPceClasses: string[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CustomerEligibility = {
  eligible: boolean;
  reasons: string[];
};

export type Blaster = {
  id: string;
  name: string;
  taxId: string;
  licenseNumber: string;
  licenseExpiresAt: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type BlasterEligibility = {
  eligible: boolean;
  reasons: string[];
};

function pageQuery(page: number, search?: string): URLSearchParams {
  const query = new URLSearchParams({ page: String(page), limit: "100" });
  if (search?.trim()) query.set("search", search.trim());
  return query;
}

export const customersApi = {
  getCustomers: (page = 1, search?: string, active?: boolean) => {
    const query = pageQuery(page, search);
    if (active !== undefined) query.set("active", String(active));
    return requestJson<PageResult<Customer>>(`/api/customers?${query.toString()}`);
  },
  getCustomer: (id: string) => requestJson<Customer>(`/api/customers/${id}`),
  createCustomer: (body: Partial<Customer>) =>
    requestJson<Customer>("/api/customers", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateCustomer: (id: string, body: Partial<Customer>) =>
    requestJson<Customer>(`/api/customers/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  checkPceEligibility: (id: string, requestedClasses: string[]) =>
    requestJson<CustomerEligibility>(`/api/customers/${id}/pce-eligibility`, {
      method: "POST",
      body: JSON.stringify({ requestedClasses }),
    }),
};

export const blastersApi = {
  getBlasters: (page = 1, search?: string, active?: boolean) => {
    const query = pageQuery(page, search);
    if (active !== undefined) query.set("active", String(active));
    return requestJson<PageResult<Blaster>>(`/api/blasters?${query.toString()}`);
  },
  getBlaster: (id: string) => requestJson<Blaster>(`/api/blasters/${id}`),
  createBlaster: (body: Partial<Blaster>) =>
    requestJson<Blaster>("/api/blasters", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateBlaster: (id: string, body: Partial<Blaster>) =>
    requestJson<Blaster>(`/api/blasters/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  checkEligibility: (id: string, eventDate: string) =>
    requestJson<BlasterEligibility>(`/api/blasters/${id}/eligibility`, {
      method: "POST",
      body: JSON.stringify({ eventDate }),
    }),
};
