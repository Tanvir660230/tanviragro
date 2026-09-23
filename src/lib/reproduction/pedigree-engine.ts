import { PedigreeNode, InbreedingEvaluation } from "./types";

export interface AnimalAncestorRecord {
  id: string;
  tagNumber: string;
  name?: string | null;
  gender: string;
  breed?: string | null;
  damId?: string | null;
  sireId?: string | null;
  damTag?: string | null;
  sireTag?: string | null;
}

export class PedigreeEngine {
  public static buildPedigreeTree(
    targetAnimalId: string,
    animalMap: Map<string, AnimalAncestorRecord>,
    maxGenerations = 3,
    currentGen = 0,
    visited = new Set<string>()
  ): PedigreeNode | null {
    if (currentGen > maxGenerations || visited.has(targetAnimalId)) {
      return null;
    }

    const animal = animalMap.get(targetAnimalId);
    if (!animal) return null;

    const newVisited = new Set(visited).add(targetAnimalId);

    const node: PedigreeNode = {
      id: animal.id,
      tagNumber: animal.tagNumber,
      name: animal.name,
      gender: (animal.gender as any) || "cow",
      breed: animal.breed,
      damId: animal.damId,
      sireId: animal.sireId,
      damTag: animal.damTag || (animal.damId ? animalMap.get(animal.damId)?.tagNumber : null),
      sireTag: animal.sireTag || (animal.sireId ? animalMap.get(animal.sireId)?.tagNumber : null),
      generation: currentGen,
      dam: null,
      sire: null,
    };

    if (currentGen < maxGenerations) {
      if (animal.damId) {
        node.dam = this.buildPedigreeTree(animal.damId, animalMap, maxGenerations, currentGen + 1, newVisited);
      }
      if (animal.sireId) {
        node.sire = this.buildPedigreeTree(animal.sireId, animalMap, maxGenerations, currentGen + 1, newVisited);
      }
    }

    return node;
  }

  public static getAncestorsWithDepth(
    animalId: string,
    animalMap: Map<string, AnimalAncestorRecord>,
    depth = 1,
    maxDepth = 5,
    result = new Map<string, number[]>()
  ): Map<string, number[]> {
    if (depth > maxDepth) return result;

    const animal = animalMap.get(animalId);
    if (!animal) return result;

    const parents = [animal.damId, animal.sireId].filter(Boolean) as string[];
    for (const parentId of parents) {
      if (!result.has(parentId)) {
        result.set(parentId, []);
      }
      result.get(parentId)!.push(depth);

      this.getAncestorsWithDepth(parentId, animalMap, depth + 1, maxDepth, result);
    }

    return result;
  }
  public static evaluateMatingCompatibility(
    femaleId: string,
    maleId: string,
    animalMap: Map<string, AnimalAncestorRecord>
  ): InbreedingEvaluation {
    if (femaleId === maleId) {
      return {
        inbreedingCoefficient: 1.0,
        inbreedingPercentage: 100,
        riskLevel: "critical",
        isMatingRecommended: false,
        commonAncestors: [],
        warningMessage: "Cannot breed animal with itself.",
      };
    }

    const female = animalMap.get(femaleId);
    const male = animalMap.get(maleId);

    // Direct parent-child check
    if (female?.damId === maleId || female?.sireId === maleId) {
      return {
        inbreedingCoefficient: 0.25,
        inbreedingPercentage: 25.0,
        riskLevel: "critical",
        isMatingRecommended: false,
        commonAncestors: [{ id: maleId, tagNumber: male?.tagNumber || "Sire", relation: "Direct Parent" }],
        warningMessage: "Direct Parent-Offspring mating causes severe inbreeding depression (F = 25%).",
      };
    }

    if (male?.damId === femaleId || male?.sireId === femaleId) {
      return {
        inbreedingCoefficient: 0.25,
        inbreedingPercentage: 25.0,
        riskLevel: "critical",
        isMatingRecommended: false,
        commonAncestors: [{ id: femaleId, tagNumber: female?.tagNumber || "Dam", relation: "Direct Parent" }],
        warningMessage: "Direct Parent-Offspring mating causes severe inbreeding depression (F = 25%).",
      };
    }

    // Trace ancestors
    const femaleAncestors = this.getAncestorsWithDepth(femaleId, animalMap);
    const maleAncestors = this.getAncestorsWithDepth(maleId, animalMap);

    let totalWrightF = 0;
    const commonAncestors: InbreedingEvaluation["commonAncestors"] = [];

    for (const [ancestorId, femaleDepths] of femaleAncestors.entries()) {
      if (maleAncestors.has(ancestorId)) {
        const maleDepths = maleAncestors.get(ancestorId)!;
        const anc = animalMap.get(ancestorId);

        let minSum = Infinity;
        for (const fd of femaleDepths) {
          for (const md of maleDepths) {
            const sum = fd + md;
            minSum = Math.min(minSum, sum);
            totalWrightF += Math.pow(0.5, sum + 1);
          }
        }

        let relation = "Common Ancestor";
        if (minSum === 2) relation = "Full or Half Sibling Parentage";
        else if (minSum === 3) relation = "Grandparent Level";

        commonAncestors.push({
          id: ancestorId,
          tagNumber: anc?.tagNumber || ancestorId,
          name: anc?.name || undefined,
          relation,
        });
      }
    }

    const inbreedingCoefficient = Math.min(1.0, Number(totalWrightF.toFixed(4)));
    const inbreedingPercentage = Number((inbreedingCoefficient * 100).toFixed(2));

    let riskLevel: InbreedingEvaluation["riskLevel"] = "none";
    let isMatingRecommended = true;
    let warningMessage: string | undefined;

    if (inbreedingCoefficient >= 0.20) {
      riskLevel = "critical";
      isMatingRecommended = false;
      warningMessage = `High inbreeding risk (F = ${inbreedingPercentage}%). Mating is strictly discouraged.`;
    } else if (inbreedingCoefficient >= 0.10) {
      riskLevel = "high";
      isMatingRecommended = false;
      warningMessage = `Elevated inbreeding (F = ${inbreedingPercentage}%). Significant risk of genetic defects.`;
    } else if (inbreedingCoefficient >= 0.05) {
      riskLevel = "moderate";
      isMatingRecommended = true;
      warningMessage = `Moderate inbreeding (F = ${inbreedingPercentage}%). Acceptable for targeted line-breeding.`;
    } else if (inbreedingCoefficient > 0) {
      riskLevel = "low";
      isMatingRecommended = true;
    }

    return {
      inbreedingCoefficient,
      inbreedingPercentage,
      riskLevel,
      isMatingRecommended,
      commonAncestors,
      warningMessage,
    };
  }
}
