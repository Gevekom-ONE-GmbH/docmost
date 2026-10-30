import { UnfurlPattern } from '../../registry/integration-provider.interface';
import { CANONICAL_PATH } from '../../utils/canonical-path';

// Jira Cloud only: the site is a single *.atlassian.net label, captured as group 1.
const JIRA_CLOUD = String.raw`^https?:\/\/${CANONICAL_PATH}([a-z0-9][a-z0-9-]*)\.atlassian\.net`;
const ISSUE_KEY = String.raw`([a-z][a-z0-9_]*-\d+)`;

export const jiraPatterns: UnfurlPattern[] = [
  // Issue: /browse/KEY-123
  {
    regex: new RegExp(
      String.raw`${JIRA_CLOUD}\/browse\/${ISSUE_KEY}(?=[\/?#]|$)`,
      'i',
    ),
    type: 'jira-issue',
  },
  // Board/backlog with a selected issue: /jira/software(/c)/projects/P/boards/1(/backlog)?selectedIssue=KEY-123
  {
    regex: new RegExp(
      String.raw`${JIRA_CLOUD}\/jira\/software(?:\/c)?\/projects\/[\w-]+\/boards\/\d+(?:\/\w+)?\?(?:[^#]*&)?selectedIssue=${ISSUE_KEY}(?=[&#]|$)`,
      'i',
    ),
    type: 'jira-issue',
  },
  // Legacy board: /secure/RapidBoard.jspa?…selectedIssue=KEY-123
  {
    regex: new RegExp(
      String.raw`${JIRA_CLOUD}\/secure\/RapidBoard\.jspa\?(?:[^#]*&)?selectedIssue=${ISSUE_KEY}(?=[&#]|$)`,
      'i',
    ),
    type: 'jira-issue',
  },
];
