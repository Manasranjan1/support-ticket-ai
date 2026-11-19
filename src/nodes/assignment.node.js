// ---------------------------------------------------------------------------
// assignment.node.js
//
// Node 2 of the LangGraph workflow.
//
// Responsibility: Assign the ticket to the correct support team based on
// the category determined by the classifyTicket node.
//
// This is PURE JAVASCRIPT — no LLM call needed.
// Simple routing rules are better expressed as code, not as LLM prompts.
// Using an LLM here would add latency and cost with no benefit.
//
// This node demonstrates that not every graph node needs to call an LLM.
// LangGraph nodes are just functions — they can do anything.
// ---------------------------------------------------------------------------

// Team assignment rules — straightforward map from category to team name
const TEAM_ASSIGNMENT = {
  Billing: 'Billing Support',
  Technical: 'Technical Support',
  Account: 'Account Support',
  General: 'General Support',
};

export async function assignTeamNode(state) {
  // Fallback to General Support if category is somehow unexpected
  const assignedTeam = TEAM_ASSIGNMENT[state.category] || 'General Support';

  console.log(`[assignTeam] Category: ${state.category} → Team: ${assignedTeam}`);

  return { assignedTeam };
}
