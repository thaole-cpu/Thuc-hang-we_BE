export class QueryBuilder {
  static build(query: any, searchFields: string[] = ['name']) {
    const { page = 1, limit = 10, search, sort, ...filters } = query;
    const skip = (Number(page) - 1) * Number(limit);
    const mongoFilter: any = {};

    if (search) {
      mongoFilter.$or = searchFields.map((field) => ({
        [field]: { $regex: search, $options: 'i' },
      }));
    }

    Object.keys(filters).forEach((key) => {
      if (filters[key] !== undefined && filters[key] !== '') {
        if (filters[key] === 'true') mongoFilter[key] = true;
        else if (filters[key] === 'false') mongoFilter[key] = false;
        else mongoFilter[key] = filters[key];
      }
    });

    let sortObj: any = { createdAt: -1 };
    if (sort) {
      const sortField = sort.startsWith('-') ? sort.substring(1) : sort;
      const sortOrder = sort.startsWith('-') ? -1 : 1;
      sortObj = { [sortField]: sortOrder };
    }

    return { filter: mongoFilter, skip, limit: Number(limit), sort: sortObj };
  }
}