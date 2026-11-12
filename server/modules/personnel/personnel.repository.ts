import * as dbServices from '../../db-services.ts';

export class PersonnelRepository {
  async getHierarchy() {
    return await dbServices.getOrganizationHierarchy();
  }

  async seedHierarchy(data: {
    companies?: Array<{ code: string; name: string; description?: string }>;
    sites?: Array<{ companyCode: string; code: string; name: string; location?: string }>;
    departments?: Array<{ siteCode: string; code: string; name: string }>;
    units?: Array<{ departmentCode: string; code: string; name: string }>;
    positions?: Array<{ title: string; code?: string; riskLevel?: string }>;
  }) {
    return await dbServices.seedOrganizationHierarchy(data);
  }

  async findAll() {
    return await dbServices.getAllPersonnel();
  }

  async findByIdentifier(identifier: string) {
    return await dbServices.getPersonnelByCodeOrNationalId(identifier);
  }

  async delete(identifier: string, deleteAssociatedUser = false) {
    return await dbServices.deletePersonnel(identifier, deleteAssociatedUser);
  }

  async upsert(data: any) {
    return await dbServices.upsertPersonnel(data);
  }

  async batchUpsert(records: any[]) {
    return await dbServices.batchUpsertPersonnel(records);
  }
}

export const personnelRepository = new PersonnelRepository();

