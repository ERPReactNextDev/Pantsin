// /pages/api/ModuleSales/Activity/LastStatus.ts
import { NextApiRequest, NextApiResponse } from "next";
import { connectToDatabase } from "@/lib/MongoDB";

export default async function lastStatus(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    const { referenceId } = req.query;

    if (!referenceId || typeof referenceId !== "string") {
      return res.status(400).json({ error: "referenceId is required" });
    }

    const db = await connectToDatabase();
    const activityLogsCollection = db.collection("TaskLog");

    /* 🕒 TODAY RANGE */
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    /* 🔍 GET LATEST ACTIVITY TODAY */
    const lastActivityToday = await activityLogsCollection.findOne(
      {
        ReferenceID: referenceId,
        date_created: {
          $gte: startOfToday,
          $lte: endOfToday,
        },
      },
      {
        sort: { date_created: -1 },
        projection: {
          Status: 1,
          date_created: 1,
        },
      }
    );

    if (!lastActivityToday) {
      return res.status(200).json(null);
    }

    return res.status(200).json({
      Status: lastActivityToday.Status,
      date_created: lastActivityToday.date_created,
    });
  } catch (error) {
    console.error("Error fetching last status:", error);
    return res.status(500).json({ error: "Failed to fetch last status" });
  }
}
