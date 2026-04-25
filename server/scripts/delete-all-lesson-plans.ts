import { db } from "../db";
import { lessonPlans } from "../db/schema/lessonPlans";

async function deleteAllLessonPlans() {
  try {
    console.log("Deleting all lesson plans...");
    const result = await db.delete(lessonPlans);
    console.log(`Deleted ${result.count} lesson plans`);
  } catch (error) {
    console.error("Error deleting lesson plans:", error);
  } finally {
    process.exit(0);
  }
}

deleteAllLessonPlans();
