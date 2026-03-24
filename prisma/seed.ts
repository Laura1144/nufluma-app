import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === "production") {
    console.error("❌ O seed não pode ser executado em ambiente de produção!");
    process.exit(1);
  }

  console.log("🌱 Seeding database...");

  const seedEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@nufluma.com";
  const seedPassword = process.env.SEED_ADMIN_PASSWORD ?? "Admin@1234";

  // Create admin user
  const hashedPassword = await bcrypt.hash(seedPassword, 12);

  const user = await db.user.upsert({
    where: { email: seedEmail },
    update: {},
    create: {
      name: "Admin Nufluma",
      email: seedEmail,
      emailVerified: new Date(),
      passwordHash: hashedPassword,
    },
  });

  // Create demo workspace
  const workspace = await db.workspace.upsert({
    where: { slug: "demo-workspace" },
    update: {},
    create: {
      name: "Demo Workspace",
      slug: "demo-workspace",
      industry: "E-commerce",
      scoreWeights: { ctr: 0.2, cpc: 0.2, cpl: 0.2, conversion: 0.2, roas: 0.2 },
    },
  });

  // Add admin to workspace
  await db.workspaceMember.upsert({
    where: { workspaceId_userId: { workspaceId: workspace.id, userId: user.id } },
    update: {},
    create: {
      workspaceId: workspace.id,
      userId: user.id,
      role: "ADMIN",
      joinedAt: new Date(),
    },
  });

  // Create campaigns
  const campaigns = await Promise.all([
    db.campaign.upsert({
      where: { id: "campaign-google" },
      update: {},
      create: {
        id: "campaign-google",
        workspaceId: workspace.id,
        name: "Google Ads — Brand",
        channel: "google_ads",
        status: "ACTIVE",
        budget: 15000,
      },
    }),
    db.campaign.upsert({
      where: { id: "campaign-meta" },
      update: {},
      create: {
        id: "campaign-meta",
        workspaceId: workspace.id,
        name: "Meta Ads — Prospecting",
        channel: "meta_ads",
        status: "ACTIVE",
        budget: 8000,
      },
    }),
    db.campaign.upsert({
      where: { id: "campaign-instagram" },
      update: {},
      create: {
        id: "campaign-instagram",
        workspaceId: workspace.id,
        name: "Instagram — Remarketing",
        channel: "instagram",
        status: "ACTIVE",
        budget: 4000,
      },
    }),
  ]);

  // Create 90 days of metrics
  const metricsToInsert = [];
  for (const campaign of campaigns) {
    for (let d = 89; d >= 0; d--) {
      const date = new Date();
      date.setDate(date.getDate() - d);

      const seed = campaign.id.charCodeAt(9) + d;
      const rand = (min: number, max: number) => min + ((seed * 9301 + 49297) % 233280) / 233280 * (max - min);

      const impressions = Math.floor(rand(8000, 18000));
      const clicks = Math.floor(impressions * rand(0.015, 0.045));
      const leads = Math.floor(clicks * rand(0.04, 0.12));
      const conversions = Math.floor(leads * rand(0.08, 0.25));
      const spend = rand(120, 300);
      const revenue = spend * rand(1.8, 6.5);

      metricsToInsert.push({
        workspaceId: workspace.id,
        campaignId: campaign.id,
        date,
        impressions,
        clicks,
        leads,
        conversions,
        spend,
        revenue,
        ctr: (clicks / impressions) * 100,
        cpc: clicks > 0 ? spend / clicks : null,
        cpl: leads > 0 ? spend / leads : null,
        cpa: conversions > 0 ? spend / conversions : null,
        roas: revenue / spend,
        convRate: clicks > 0 ? (conversions / clicks) * 100 : null,
        source: "seed",
      });
    }
  }

  await db.metric.createMany({ data: metricsToInsert, skipDuplicates: true });

  // Create alerts
  await db.alertRule.createMany({
    data: [
      {
        workspaceId: workspace.id,
        name: "CPL acima de R$80",
        type: "COST_PER_LEAD_SPIKE",
        metric: "cpl",
        condition: "gt",
        threshold: 80,
        severity: "HIGH",
        enabled: true,
        channels: ["email"],
      },
      {
        workspaceId: workspace.id,
        name: "CTR abaixo de 1%",
        type: "CTR_DROP",
        metric: "ctr",
        condition: "lt",
        threshold: 1,
        severity: "MEDIUM",
        enabled: true,
        channels: ["email"],
      },
    ],
    skipDuplicates: true,
  });

  // Demo missions
  await db.mission.createMany({
    data: [
      {
        workspaceId: workspace.id,
        title: "Atingir 2.000 leads no mês",
        description: "Escale campanhas para 2.000 leads mensais",
        metric: "leads",
        target: 2000,
        current: 1240,
        expiresAt: new Date(Date.now() + 15 * 86400000),
      },
      {
        workspaceId: workspace.id,
        title: "ROAS acima de 5x",
        description: "Melhore qualidade dos leads para ROAS 5x",
        metric: "roas",
        target: 5,
        current: 3.8,
        expiresAt: new Date(Date.now() + 30 * 86400000),
      },
    ],
    skipDuplicates: true,
  });

  console.log("✅ Seed concluído!");
  console.log(`   Email: ${seedEmail}`);
  console.log(`   Senha: ${process.env.SEED_ADMIN_PASSWORD ? "(configurada via SEED_ADMIN_PASSWORD)" : "Admin@1234"}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
