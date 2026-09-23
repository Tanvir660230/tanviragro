import {
  AiPredictionEngine,
  AiRecommendationEngine,
  AiNaturalLanguageEngine,
  AiAutomationEngine,
  AiAuditService,
} from "@/lib/ai";

describe("Sprint 20: Enterprise AI Decision Support Platform", () => {
  const businessId = "biz-sprint-20-test";
  const userId = "usr-test-agent";

  describe("AiPredictionEngine", () => {
    test("calculates disease risk correctly with contributing factors", async () => {
      const risk = await AiPredictionEngine.predictDiseaseRisk({
        id: "c-101",
        tagNumber: "TAG-101",
        temperatureLogs: [{ temperature: 39.8, recordedAt: "2026-09-10T08:00:00Z" }],
        overdueVaccinesCount: 1,
      });

      expect(risk.riskLevel).toBe("HIGH");
      expect(risk.overallRiskScore).toBeGreaterThanOrEqual(50);
      expect(risk.explainability.contributingFactors.length).toBeGreaterThan(0);
      expect(risk.earlyWarningSignals.length).toBeGreaterThan(0);
      expect(risk.recommendedVetIntervention).toBeTruthy();
    });

    test("predicts growth trajectory with ADG projections", async () => {
      const growth = await AiPredictionEngine.predictGrowthTrajectory({
        id: "c-102",
        tagNumber: "TAG-102",
        currentWeightKg: 400,
        targetWeightKg: 500,
        historicalAdgKg: 1.0,
      });

      expect(growth.projectedWeight30Days).toBe(430);
      expect(growth.projectedWeight60Days).toBe(460);
      expect(growth.projectedWeight90Days).toBe(490);
      expect(growth.projectedDaysToTarget).toBe(100);
      expect(growth.explainability.confidenceScore).toBe(0.92);
    });

    test("forecasts feed demand based on herd head count and biomass", async () => {
      const feedForecast = await AiPredictionEngine.forecastFeedDemand({
        activeHeadCount: 2,
        totalBiomassKg: 900,
        daysAhead: 14,
      });

      expect(feedForecast.dryMatterRequiredKg).toBeGreaterThan(0);
      expect(feedForecast.daysAhead).toBe(14);
      expect(feedForecast.estimatedFeedCostBdt).toBeGreaterThan(0);
    });
  });

  describe("AiRecommendationEngine", () => {
    test("generates vaccination compliance recommendations", () => {
      const recs = AiRecommendationEngine.generateOperationalRecommendations({
        businessId,
        overdueVaccines: [
          {
            cattleId: "c-201",
            tagNumber: "TAG-201",
            vaccineName: "Anthrax",
            dueDate: "2026-09-01",
          },
        ],
      });

      expect(recs.length).toBe(1);
      expect(recs[0].category).toBe("VACCINATION");
    });
  });

  describe("AiNaturalLanguageEngine", () => {
    test("parses weight loss queries in English", async () => {
      const enRes = await AiNaturalLanguageEngine.processNaturalLanguageQuery(
        {
          businessId,
          query: "which cattle lost weight?",
          locale: "en",
        },
        {
          cattle: [
            { tag_id: "TAG-1", breed: "Friesian", current_weight_kg: 400, purchase_weight_kg: 405 },
            { tag_id: "TAG-2", breed: "Sahiwal", current_weight_kg: 380, purchase_weight_kg: 370 },
          ],
        }
      );

      expect(enRes.intent).toBe("FILTER_ANIMALS");
      expect(enRes.structuredData?.length).toBe(1);
    });

    test("parses Bengali vaccine overdue queries", async () => {
      const bnRes = await AiNaturalLanguageEngine.processNaturalLanguageQuery(
        {
          businessId,
          query: "কোন গরুর টিকা বাকি?",
          locale: "bn",
        },
        {
          healthEvents: [
            { title: "Anthrax Booster", status: "pending", scheduled_at: "2020-01-01", cattle_id: "c-1" },
          ],
        }
      );

      expect(bnRes.intent).toBe("HEALTH_VACCINATION_OVERDUE");
      expect(bnRes.answerSummary).toContain("বকেয়া");
    });
  });

  describe("AiAutomationEngine", () => {
    test("proposes and executes automations with approval", async () => {
      const proposal = AiAutomationEngine.proposeAutomation({
        businessId,
        actionType: "REORDER_INVENTORY",
        title: "Reorder 500kg Cattle Feed",
        description: "Stock is low",
        urgency: "ACTION_REQUIRED",
        parameters: { itemId: "feed-101", quantity: 500 },
        confidenceScore: 0.95,
        reasoning: "Stock drops to 0 in 2 days",
      });

      expect(proposal.status).toBe("PENDING_APPROVAL");
      const execution = await AiAutomationEngine.approveAndExecute(proposal.id, userId, "Approved");
      expect(execution.success).toBe(true);
      expect(execution.proposal.executionResult?.status).toBe("SUCCESS");
    });
  });

  describe("AiAuditService", () => {
    test("masks PII phone and email in logs", () => {
      const log = AiAuditService.logInference({
        businessId,
        userId,
        task: "treatment_recommendation",
        provider: "local_rules",
        model: "rule-based-v1",
        latencyMs: 12,
        prompt: "Contact john@example.com or 01712345678",
        outputSummary: "Sent to 01812345678",
        confidenceScore: 0.9,
      });

      expect(log.sanitizedPrompt).toContain("[REDACTED_EMAIL]");
      expect(log.sanitizedPrompt).toContain("[REDACTED_PHONE]");
    });
  });
});
