/**
 * CBSE Class 9 & 10 Study Tracker - Preparation Stage Definitions
 * Defines per-class stage keys, display order, and subject-aware human-readable stage labels.
 */

(function () {
  "use strict";

  const STAGE_SETS = {
    9: ["theory", "ncert", "revision"],
    10: ["theory", "ncert", "exemplar", "pyq", "cbq"] // Note: Previous Year Questions before Competency Focused Questions
  };

  const STAGE_LABELS_BY_SUBJECT = {
    maths: {
      theory: "Concepts and Formulae"
    },
    default: {
      theory: "Theory Read",
      ncert: "NCERT Questions",
      exemplar: "NCERT Exemplar Questions",
      pyq: "Previous Year Questions",
      cbq: "Competency Focused Questions",
      revision: "Revision"
    }
  };

  /**
   * Returns dynamic stage keys array for a given grade in exact display order
   */
  function getStageKeysForGrade(grade) {
    return (STAGE_SETS[grade] || STAGE_SETS[10]);
  }

  /**
   * Label resolver function.
   * Can be called as getStageLabel("maths", "theory") OR getStageLabel("theory").
   */
  function getStageLabel(subjectId, stageKey) {
    if (!stageKey) {
      stageKey = subjectId;
      subjectId = "default";
    }

    const subKey = (subjectId || "default").toString().toLowerCase();

    if (STAGE_LABELS_BY_SUBJECT[subKey] && STAGE_LABELS_BY_SUBJECT[subKey][stageKey]) {
      return STAGE_LABELS_BY_SUBJECT[subKey][stageKey];
    }

    return STAGE_LABELS_BY_SUBJECT.default[stageKey] || stageKey;
  }

  if (typeof window !== "undefined") {
    window.STAGE_SETS = STAGE_SETS;
    window.STAGE_LABELS_BY_SUBJECT = STAGE_LABELS_BY_SUBJECT;
    window.getStageLabel = getStageLabel;
    window.getStageKeysForGrade = getStageKeysForGrade;
  }
})();
