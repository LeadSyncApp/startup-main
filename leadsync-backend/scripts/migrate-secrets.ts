import { prisma } from "../src/lib/prisma";
import { encrypt, isEncrypted } from "../src/utils/encryption";

async function runMigration() {
    console.log("Starting migration to encrypted secrets...");
    const companies = await prisma.company.findMany();

    for (const company of companies) {
        let updateNeeded = false;
        const updateData: any = {};

        if (company.telegramBotToken && !isEncrypted(company.telegramBotToken)) {
            try {
                updateData.telegramBotToken = encrypt(company.telegramBotToken);
                updateNeeded = true;
            } catch (e) {
                console.error(`Failed to encrypt telegramBotToken for company ${company.id}`);
            }
        }                
        if (company.telegramWebhookSecret && !isEncrypted(company.telegramWebhookSecret)) {
            try {
                updateData.telegramWebhookSecret = encrypt(company.telegramWebhookSecret);
                updateNeeded = true;
            } catch (e) {
                console.error(`Failed to encrypt telegramWebhookSecret for company ${company.id}`);
            }
        }
        if (company.instagramPageAccessToken && !isEncrypted(company.instagramPageAccessToken)) {
            try {
                updateData.instagramPageAccessToken = encrypt(company.instagramPageAccessToken);
                updateNeeded = true;
            } catch (e) {
                console.error(`Failed to encrypt instagramPageAccessToken for company ${company.id}`);
            }
        }
        
        if (updateNeeded) {
            await prisma.company.update({
                where: { id: company.id },
                data: updateData
            });
            console.log(`Migrated secrets for company: ${company.id}`);
        }
    }
    await prisma.$disconnect();
    console.log("Migration finished.");
}

runMigration().catch(console.error);
