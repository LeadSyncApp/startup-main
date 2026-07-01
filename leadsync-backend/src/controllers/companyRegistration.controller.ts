// /startup-new6/startup/leadsync-backend/src/controllers/companyRegistration.controller.ts

import { Request, Response } from "express";
import { prisma } from "../lib/prisma";

export async function createNewEnterpriseTenant(req: Request, res: Response) {
  const { organizationName, currencyCode, currencySymbol, timezone } = req.body;

  try {
    const newCompany = await prisma.company.create({
      data: {
        name: organizationName,
        // Enforce explicit runtime inputs during onboarding lifecycle registration
        currencyCode: currencyCode?.toUpperCase() || "USD",
        currencySymbol: currencySymbol || "$",
        timezone: timezone || "UTC",
        companyCode: req.body.companyCode || `COMP-${Math.floor(1000 + Math.random() * 9000)}`
      }
    });

    return res.status(201).json({ status: "success", data: newCompany });
  } catch (error) {
    console.error("[OnboardingException] Failed creating new enterprise tenant:", error);
    return res.status(500).json({ status: "error", message: "Onboarding exception managed." });
  }
}
