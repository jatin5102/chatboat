export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export async function paginate<T>(
  model: any,
  args: any,
  { page = 1, limit = 10 }: PaginationParams,
): Promise<PaginatedResponse<T>> {
  const skip = (page - 1) * limit;

  // Fetch total records
  const total = await model.count({
    where: args.where || {},
  });

  // Fetch paginated data
  const data = await model.findMany({
    ...args,
    skip,
    take: limit,
  });
  const totalPages = Math.ceil(total / limit);

  return {
    data,
    pagination: {
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  };
}
