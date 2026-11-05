import type { DateISO, Goal, GoalContribution, Minor } from './types';

export interface GoalProgress {
  goal: Goal;
  contributed: Minor;
  /** Net contributions (withdrawals subtract). */
  balance: Minor;
  remaining: Minor;
  progress: number;
  lastContribution?: DateISO;
  contributionCount: number;
}

export function goalProgress(goal: Goal, contributions: GoalContribution[]): GoalProgress {
  const scoped = contributions.filter((c) => c.goalId === goal.id);
  const balance = scoped.reduce((sum, c) => sum + c.amount, 0);
  const remaining = Math.max(0, goal.targetAmount - balance);
  const latest = [...scoped].sort((a, b) => b.date.localeCompare(a.date))[0];
  return {
    goal,
    contributed: scoped.reduce((sum, c) => sum + Math.max(0, c.amount), 0),
    balance,
    remaining,
    progress: goal.targetAmount > 0 ? (balance / goal.targetAmount) * 100 : 0,
    lastContribution: latest?.date,
    contributionCount: scoped.length,
  };
}

export function totalGoalSavings(goals: Goal[], contributions: GoalContribution[]): Minor {
  return goals
    .filter((g) => !g.archived)
    .reduce((sum, goal) => sum + Math.max(0, goalProgress(goal, contributions).balance), 0);
}

/** Monthly amount needed to hit a goal by its target date (estimate). */
export function requiredMonthlyContribution(
  goal: Goal,
  contributions: GoalContribution[],
  today: DateISO,
): Minor | null {
  if (!goal.targetDate) return null;
  const progress = goalProgress(goal, contributions);
  if (progress.remaining <= 0) return 0;
  const from = new Date(`${today}T00:00:00Z`).getTime();
  const to = new Date(`${goal.targetDate}T00:00:00Z`).getTime();
  if (to < from) return progress.remaining;
  const months = Math.max(1, Math.ceil((to - from) / (86_400_000 * 30.4375)));
  return Math.ceil(progress.remaining / months);
}
