import { Client } from 'pg';

async function checkDbSchema() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log("Connecting to database...");
    await client.connect();
    console.log("Connected to database");

    console.log("Checking lesson_plans table schema...");
    const result = await client.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'lesson_plans'
      ORDER BY ordinal_position;
    `);
    console.log("Table schema:", result.rows);

    // Check if is_public column exists
    const isPublicColumn = result.rows.find(row => row.column_name === 'is_public');
    if (isPublicColumn) {
      console.log("is_public column exists:", isPublicColumn);
    } else {
      console.log("is_public column does not exist");

      // Add the column
      console.log("Adding is_public column...");
      await client.query(`
        ALTER TABLE lesson_plans
        ADD COLUMN is_public BOOLEAN DEFAULT FALSE;
      `);
      console.log("is_public column added successfully");
    }
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await client.end();
    console.log("Disconnected from database");
    process.exit(0);
  }
}

checkDbSchema();
