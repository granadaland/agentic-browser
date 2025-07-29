import { describe, it, expect } from 'vitest';
import { formatToolOutput } from './formatToolOutput';

describe('formatToolOutput', () => {
  it('tests that error cases are handled properly', () => {
    const errorResult = {
      ok: false,
      error: 'Something went wrong'
    };
    
    const output = formatToolOutput('navigation_tool', errorResult);
    expect(output).toBe('❌ Error in navigation_tool: Something went wrong');
  });

  it('tests that success cases format properly', () => {
    const successResult = {
      ok: true,
      output: {
        url: 'https://example.com',
        success: true
      }
    };
    
    const output = formatToolOutput('navigation_tool', successResult);
    expect(output).toBeTruthy();
    expect(output.length).toBeGreaterThan(0);
    expect(output).not.toContain('❌ Error');
  });

  it('tests that planner tool formats output properly', () => {
    const plannerResult = {
      ok: true,
      output: {
        steps: [
          { action: 'Navigate to page', reasoning: 'Need to access the site' },
          { action: 'Click button', reasoning: 'Submit the form' }
        ]
      }
    };
    
    const output = formatToolOutput('planner_tool', plannerResult);
    expect(output).toBeTruthy();
    expect(output.length).toBeGreaterThan(0);
    expect(output).not.toContain('❌ Error');
  });

  it('tests that unknown tools fallback to JSON', () => {
    const unknownResult = {
      ok: true,
      output: { data: 'test', value: 123 }
    };
    
    const output = formatToolOutput('unknown_tool', unknownResult);
    expect(output).toBeTruthy();
    expect(output.length).toBeGreaterThan(0);
    expect(output).toContain('json');  // Should contain json formatting
  });
});