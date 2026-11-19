import { assignTeamNode } from '../src/nodes/assignment.node.js';

describe('Team Assignment Node (assignTeamNode)', () => {
  test('should route Billing tickets to Billing Support', async () => {
    const result = await assignTeamNode({ category: 'Billing' });
    expect(result).toEqual({ assignedTeam: 'Billing Support' });
  });

  test('should route Technical tickets to Technical Support', async () => {
    const result = await assignTeamNode({ category: 'Technical' });
    expect(result).toEqual({ assignedTeam: 'Technical Support' });
  });

  test('should route Account tickets to Account Support', async () => {
    const result = await assignTeamNode({ category: 'Account' });
    expect(result).toEqual({ assignedTeam: 'Account Support' });
  });

  test('should route General tickets to General Support', async () => {
    const result = await assignTeamNode({ category: 'General' });
    expect(result).toEqual({ assignedTeam: 'General Support' });
  });

  test('should default to General Support for unknown or missing categories', async () => {
    const result = await assignTeamNode({ category: 'UnknownCategory' });
    expect(result).toEqual({ assignedTeam: 'General Support' });
  });
});
