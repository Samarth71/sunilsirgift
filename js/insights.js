/**
 * CBSE Class 9 & 10 Study Tracker - Insights Module
 * Hand-rolled offline SVG visualizations for subject analytics, pace comparison, and 7-day activity trend.
 */

(function () {
  "use strict";

  /**
   * Computes 7-day activity count map (ISO date -> count of stage updates)
   */
  function get7DayActivityData(profile) {
    const today = new Date(window.TrackerStorage.getTodayString());
    const dateCounts = {};
    const datesList = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const iso = d.toISOString().split("T")[0];
      dateCounts[iso] = 0;
      datesList.push(iso);
    }

    if (profile && profile.progress) {
      Object.values(profile.progress).forEach(progObj => {
        if (progObj && progObj.updatedAt) {
          const uIso = progObj.updatedAt.split("T")[0];
          if (dateCounts[uIso] !== undefined) {
            dateCounts[uIso] += 1;
          }
        }
      });
    }

    return { dateCounts, datesList };
  }

  /**
   * Renders global 7-day activity trend SVG bar chart
   */
  function render7DayTrendSvg(profile) {
    const { dateCounts, datesList } = get7DayActivityData(profile);
    const maxVal = Math.max(...Object.values(dateCounts), 5);

    const svgWidth = 320;
    const svgHeight = 120;
    const barWidth = 28;
    const gap = 16;
    const startX = 14;

    let barsHtml = "";
    datesList.forEach((isoDate, idx) => {
      const count = dateCounts[isoDate] || 0;
      const barHeight = Math.round((count / maxVal) * 70);
      const x = startX + idx * (barWidth + gap);
      const y = 85 - barHeight;

      const d = new Date(isoDate);
      const dayLabel = d.toLocaleDateString("en-US", { weekday: "short" });

      barsHtml += `
        <rect x="${x}" y="${y}" width="${barWidth}" height="${Math.max(barHeight, 4)}" rx="4" fill="${count > 0 ? "var(--accent-primary)" : "var(--border-color)"}" />
        <text x="${x + barWidth / 2}" y="${y - 4}" text-anchor="middle" font-size="10" fill="var(--text-secondary)" font-weight="600">${count}</text>
        <text x="${x + barWidth / 2}" y="105" text-anchor="middle" font-size="11" fill="var(--text-secondary)">${dayLabel}</text>
      `;
    });

    return `
      <div class="trend-chart-wrapper">
        <svg viewBox="0 0 ${svgWidth} ${svgHeight}" class="insights-svg">
          <line x1="10" y1="85" x2="310" y2="85" stroke="var(--border-color)" stroke-width="1" />
          ${barsHtml}
        </svg>
      </div>
    `;
  }

  /**
   * Calculates subject analytics for Insights view
   */
  function calculateSubjectAnalytics(profile, subjectData) {
    const pace = window.TrackerPlanner.calculateSubjectPace(profile, subjectData);
    const stageKeys = window.TrackerStorage.getStageKeysForGrade(profile.grade);

    // Calculate actual pace over last 7 days for this subject
    const today = new Date(window.TrackerStorage.getTodayString());
    let recentCompletedStages = 0;

    pace.inSyllabusChapters.forEach(ch => {
      const key = `${subjectData.id}.${ch.id}`;
      const chProg = profile.progress ? profile.progress[key] : null;
      if (chProg && chProg.updatedAt) {
        const uDate = new Date(chProg.updatedAt.split("T")[0]);
        const diffDays = (today - uDate) / (1000 * 60 * 60 * 24);
        if (diffDays <= 7 && diffDays >= 0) {
          stageKeys.forEach(sk => {
            if (chProg[sk] === "done") recentCompletedStages += 1;
            else if (chProg[sk] === "progress") recentCompletedStages += 0.5;
          });
        }
      }
    });

    const actualPace = parseFloat((recentCompletedStages / 7).toFixed(1));

    // Stage breakdown metrics
    const stageBreakdown = [];
    let lowestPct = 101;
    let highestPct = -1;
    let weakestStageObj = null;
    let strongestStageObj = null;

    stageKeys.forEach(sk => {
      let doneCh = 0;
      let progCh = 0;
      let noneCh = 0;

      pace.inSyllabusChapters.forEach(ch => {
        const key = `${subjectData.id}.${ch.id}`;
        const chProg = profile.progress ? profile.progress[key] : null;
        const st = chProg ? chProg[sk] || "none" : "none";
        if (st === "done") doneCh++;
        else if (st === "progress") progCh++;
        else noneCh++;
      });

      const totalCh = pace.scopedChapterCount;
      const stageScore = doneCh + 0.5 * progCh;
      const pct = totalCh > 0 ? Math.round((stageScore / totalCh) * 100) : 0;
      const label = window.getStageLabel(subjectData.id, sk);

      const item = { key: sk, label, doneCh, progCh, noneCh, totalCh, pct };
      stageBreakdown.push(item);

      if (totalCh > 0) {
        if (pct < lowestPct) {
          lowestPct = pct;
          weakestStageObj = item;
        }
        if (pct > highestPct) {
          highestPct = pct;
          strongestStageObj = item;
        }
      }
    });

    // Determine Lagging Callout text
    let focusCallout = null;
    if (weakestStageObj && strongestStageObj && (highestPct - lowestPct) >= 20 && pace.scopedChapterCount > 0) {
      focusCallout = `Weakest spot: <strong>${escapeHtml(weakestStageObj.label)}</strong> — only ${weakestStageObj.pct}% done vs ${strongestStageObj.pct}% for ${escapeHtml(strongestStageObj.label)}.`;
    }

    return {
      ...pace,
      stageKeys,
      actualPace,
      stageBreakdown,
      focusCallout
    };
  }

  /**
   * Renders SVG Donut chart for completion %
   */
  function renderDonutChartSvg(pct) {
    const radius = 36;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (pct / 100) * circumference;

    return `
      <div class="donut-chart-wrapper">
        <svg viewBox="0 0 100 100" class="donut-svg">
          <circle class="donut-bg" cx="50" cy="50" r="${radius}" stroke-width="8" fill="transparent" />
          <circle class="donut-fill" cx="50" cy="50" r="${radius}" stroke-width="8" fill="transparent"
                  stroke-dasharray="${circumference}" stroke-dashoffset="${strokeDashoffset}" />
          <text x="50" y="55" text-anchor="middle" font-size="20" font-weight="700" fill="var(--text-primary)">${pct}%</text>
        </svg>
      </div>
    `;
  }

  /**
   * Renders dual pace comparison bar SVG
   */
  function renderPaceComparisonSvg(actualPace, requiredPace) {
    const maxVal = Math.max(actualPace, requiredPace, 3);
    const actualWidth = Math.round((actualPace / maxVal) * 100);
    const reqWidth = Math.round((requiredPace / maxVal) * 100);

    let statusColor = "green";
    if (actualPace < requiredPace * 0.8) statusColor = "red";
    else if (actualPace < requiredPace) statusColor = "amber";

    return `
      <div class="pace-comparison-box">
        <div class="pace-bar-row">
          <span class="pace-bar-label">Your Pace (${actualPace}/day):</span>
          <div class="pace-bar-track">
            <div class="pace-bar-fill ${statusColor}" style="width: ${actualWidth}%;"></div>
          </div>
        </div>

        <div class="pace-bar-row">
          <span class="pace-bar-label">Target Pace (${requiredPace}/day):</span>
          <div class="pace-bar-track">
            <div class="pace-bar-fill target" style="width: ${reqWidth}%;"></div>
          </div>
        </div>

        <p class="pace-comparison-subtext">
          ${actualPace >= requiredPace ? `
            ✨ You're pacing at <strong>${actualPace} stages/day</strong>, meeting your target of ${requiredPace}/day.
          ` : `
            ⚡ You're doing <strong>${actualPace} stages/day</strong>. You need <strong>${requiredPace}/day</strong> to finish on time.
          `}
        </p>
      </div>
    `;
  }

  /**
   * Renders stage breakdown stacked bars for subject
   */
  function renderStageBreakdownHtml(stageBreakdown) {
    return stageBreakdown.map(sb => {
      const donePct = sb.totalCh > 0 ? (sb.doneCh / sb.totalCh) * 100 : 0;
      const progPct = sb.totalCh > 0 ? (sb.progCh / sb.totalCh) * 100 : 0;
      const nonePct = sb.totalCh > 0 ? (sb.noneCh / sb.totalCh) * 100 : 0;

      return `
        <div class="stage-breakdown-row">
          <div class="stage-breakdown-header">
            <span class="stage-name">${escapeHtml(sb.label)}</span>
            <span class="stage-counts">${sb.doneCh} done, ${sb.progCh} in progress, ${sb.noneCh} pending</span>
          </div>

          <div class="stacked-bar">
            <div class="bar-segment done" style="width:${donePct}%;" title="Done: ${sb.doneCh}"></div>
            <div class="bar-segment progress" style="width:${progPct}%;" title="In Progress: ${sb.progCh}"></div>
            <div class="bar-segment none" style="width:${nonePct}%;" title="Pending: ${sb.noneCh}"></div>
          </div>
        </div>
      `;
    }).join("");
  }

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  window.TrackerInsights = {
    get7DayActivityData,
    render7DayTrendSvg,
    calculateSubjectAnalytics,
    renderDonutChartSvg,
    renderPaceComparisonSvg,
    renderStageBreakdownHtml
  };
})();
