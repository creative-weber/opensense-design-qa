const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:3001';

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'content-type': 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    throw new Error(`${path} failed with ${response.status}: ${await response.text()}`);
  }

  return (await response.json()) as T;
}

async function waitForRunStatus(runId: string, expectedStatuses: string[], timeoutMs = 10000): Promise<void> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const run = await requestJson<{ status: string }>(`/api/runs/${runId}`);
    if (expectedStatuses.includes(run.status)) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  throw new Error(`Run ${runId} did not reach one of: ${expectedStatuses.join(', ')}`);
}

console.log('Starting API test...');

(async () => {
  console.log('Creating project fixture...');
  const project = await requestJson<{ id: string; name: string }>(`/api/projects`, {
    method: 'POST',
    body: JSON.stringify({ name: 'API Findings Harness' }),
  });

  console.log('Creating run fixture...');
  const run = await requestJson<{ id: string }>(`/api/runs`, {
    method: 'POST',
    body: JSON.stringify({
      projectId: project.id,
      url: 'http://localhost:3000/fixtures/overflow',
      viewports: ['desktop'],
    }),
  });

  console.log('Waiting for findings generation...');
  await waitForRunStatus(run.id, ['rules_complete', 'complete']);

  console.log('Fetching findings...');
  const response = await fetch(`${API_BASE_URL}/api/runs/${run.id}/findings?page=1&pageSize=20`);
  console.log('Status:', response.status);

  if (response.ok) {
    const data = (await response.json()) as { data: any[]; total: number };
    console.log(
      JSON.stringify(
        {
          runId: run.id,
          dataLength: data.data?.length,
          total: data.total,
          firstFinding: data.data?.[0]
            ? {
                title: data.data[0].title,
                ruleId: data.data[0].ruleId,
                evidenceCount: data.data[0].evidence?.length,
                firstEvidenceKeys: Object.keys(data.data[0].evidence?.[0] || {}),
              }
            : null,
        },
        null,
        2
      )
    );
  } else {
    console.log('Error response received:', await response.text());
  }
})();