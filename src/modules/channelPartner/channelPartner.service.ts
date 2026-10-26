import { prisma } from "../../config/prisma.config.js";
import { ICreateChannelPartner, IUpdateChannelPartner } from "./channelPartner.interface.js";

export const getList = async (search?: string) => {
  const where: any = {};
  if (search) {
    where.OR = [
      { fullName: { contains: search, mode: "insensitive" } },
      { firmName: { contains: search, mode: "insensitive" } },
      { reraNumber: { contains: search, mode: "insensitive" } },
      { mobileNo: { contains: search, mode: "insensitive" } },
    ];
  }

  return prisma.channelPartner.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });
};

export const getById = async (idOrRera: string) => {
  return prisma.channelPartner.findFirst({
    where: {
      OR: [{ id: idOrRera }, { reraNumber: idOrRera }],
    },
  });
};

export const create = async (data: ICreateChannelPartner) => {
  return prisma.channelPartner.create({
    data: {
      fullName: data.fullName.trim(),
      firmName: data.firmName.trim(),
      reraNumber: data.reraNumber.trim(),
      mobileNo: data.mobileNo.trim(),
      emailAddress: data.emailAddress || null,
      location: data.location || "Noida",
      status: data.status !== undefined ? data.status : true,
    },
  });
};

export const update = async (id: string, data: IUpdateChannelPartner) => {
  return prisma.channelPartner.update({
    where: { id },
    data,
  });
};

export const destroy = async (id: string) => {
  return prisma.channelPartner.delete({
    where: { id },
  });
};
