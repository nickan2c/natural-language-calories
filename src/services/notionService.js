const NOTION_TOKEN = import.meta.env.VITE_NOTION_TOKEN;
const DATABASE_ID = import.meta.env.VITE_NOTION_DATABASE_ID;

export async function fetchNotionDailyLogs() {
  const allResults = [];
  let hasMore = true;
  let startCursor = undefined;

  while (hasMore) {
    const body = {
      page_size: 100,
      sorts: [{ property: 'Date', direction: 'ascending' }],
    };
    if (startCursor) body.start_cursor = startCursor;

    const res = await fetch(`/api/notion/v1/databases/${DATABASE_ID}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NOTION_TOKEN}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw new Error(`Notion API error: ${res.status}`);
    }

    const data = await res.json();
    allResults.push(...data.results);
    hasMore = data.has_more;
    startCursor = data.next_cursor;
  }

  return allResults.map(parseNotionRow).filter((r) => r.date);
}

function parseNotionRow(page) {
  const props = page.properties;
  return {
    date: props['Date']?.date?.start || null,
    calories: props['Calories']?.number ?? null,
    protein: props['Protein (g)']?.number ?? null,
    steps: props['Steps']?.number ?? null,
    caloriesVsTarget: props['Calories vs 2700']?.formula?.number ?? null,
  };
}
