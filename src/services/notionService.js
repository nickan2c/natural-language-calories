const NOTION_TOKEN = import.meta.env.VITE_NOTION_TOKEN;
const DATABASE_ID = import.meta.env.VITE_NOTION_DATABASE_ID;
const isDev = import.meta.env.DEV;

/**
 * In dev: Vite proxy handles CORS, client sends auth headers
 * In prod: Firebase Cloud Function proxies to Notion with server-side auth
 */
async function notionFetch(apiPath, options = {}) {
  if (isDev) {
    // Dev: Vite proxy rewrites /api/notion -> https://api.notion.com
    return fetch(`/api/notion${apiPath}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${NOTION_TOKEN}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
  } else {
    // Prod: Cloud Function at /api/notion?path=...
    return fetch(`/api/notion?path=${encodeURIComponent(apiPath)}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
  }
}

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

    const res = await notionFetch(`/v1/databases/${DATABASE_ID}/query`, {
      method: 'POST',
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
    id: page.id,
    date: props['Date']?.date?.start || null,
    calories: props['Calories']?.number ?? null,
    protein: props['Protein (g)']?.number ?? null,
    steps: props['Steps']?.number ?? null,
    caloriesVsTarget: props['Calories vs 2700']?.formula?.number ?? null,
  };
}

/**
 * Get recent days from Notion for LLM context
 */
export async function getRecentNotionLogs(days = 7) {
  const res = await notionFetch(`/v1/databases/${DATABASE_ID}/query`, {
    method: 'POST',
    body: JSON.stringify({
      page_size: days,
      sorts: [{ property: 'Date', direction: 'descending' }],
    }),
  });

  if (!res.ok) return [];

  const data = await res.json();
  return data.results.map(parseNotionRow).filter((r) => r.date).reverse();
}

/**
 * Find today's Notion row, or null if it doesn't exist
 */
async function findNotionRowByDate(dateStr) {
  const res = await notionFetch(`/v1/databases/${DATABASE_ID}/query`, {
    method: 'POST',
    body: JSON.stringify({
      filter: {
        property: 'Date',
        date: { equals: dateStr },
      },
      page_size: 1,
    }),
  });

  if (!res.ok) return null;

  const data = await res.json();
  return data.results.length > 0 ? data.results[0] : null;
}

/**
 * Update or create today's Notion row with calorie/protein totals
 */
export async function syncToNotion(dateStr, calories, protein) {
  try {
    const existing = await findNotionRowByDate(dateStr);

    if (existing) {
      const res = await notionFetch(`/v1/pages/${existing.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          properties: {
            'Calories': { number: calories },
            'Protein (g)': { number: protein },
          },
        }),
      });
      if (!res.ok) throw new Error(`Notion update failed: ${res.status}`);
      console.log(`Updated Notion row for ${dateStr}: ${calories} cal, ${protein}g protein`);
    } else {
      const dayLabel = new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      });

      const res = await notionFetch('/v1/pages', {
        method: 'POST',
        body: JSON.stringify({
          parent: { database_id: DATABASE_ID },
          properties: {
            'Day': { title: [{ text: { content: dayLabel } }] },
            'Date': { date: { start: dateStr } },
            'Calories': { number: calories },
            'Protein (g)': { number: protein },
          },
        }),
      });
      if (!res.ok) throw new Error(`Notion create failed: ${res.status}`);
      console.log(`Created Notion row for ${dateStr}: ${calories} cal, ${protein}g protein`);
    }
  } catch (error) {
    console.error('Error syncing to Notion:', error);
  }
}

/**
 * Update specific fields on a Notion row (steps, calories, protein)
 */
export async function updateNotionFields(dateStr, updates) {
  try {
    const existing = await findNotionRowByDate(dateStr);

    const properties = {};
    if (updates.steps !== undefined) properties['Steps'] = { number: updates.steps };
    if (updates.calories !== undefined) properties['Calories'] = { number: updates.calories };
    if (updates.protein !== undefined) properties['Protein (g)'] = { number: updates.protein };

    if (Object.keys(properties).length === 0) return;

    if (existing) {
      const res = await notionFetch(`/v1/pages/${existing.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ properties }),
      });
      if (!res.ok) throw new Error(`Notion update failed: ${res.status}`);
    } else {
      const dayLabel = new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      });
      const res = await notionFetch('/v1/pages', {
        method: 'POST',
        body: JSON.stringify({
          parent: { database_id: DATABASE_ID },
          properties: {
            'Day': { title: [{ text: { content: dayLabel } }] },
            'Date': { date: { start: dateStr } },
            ...properties,
          },
        }),
      });
      if (!res.ok) throw new Error(`Notion create failed: ${res.status}`);
    }
    console.log(`Updated Notion for ${dateStr}:`, updates);
    return true;
  } catch (error) {
    console.error('Error updating Notion fields:', error);
    return false;
  }
}
