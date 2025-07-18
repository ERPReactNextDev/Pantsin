import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

const Xchire_databaseUrl = process.env.TASKFLOW_DB_URL;
if (!Xchire_databaseUrl) {
    throw new Error("TASKFLOW_DB_URL is not set in the environment variables.");
}

const Xchire_sql = neon(Xchire_databaseUrl);

// Insert function with optional tsm and manager
async function create(
    referenceid: string,
    manager: string | null,
    tsm: string | null,
    companyname: string,
    contactperson: string,
    contactnumber: string,
    emailaddress: string,
    typeclient: string,
    address: string,
    deliveryaddress: string,
    area: string,
    status: string
) {
    try {
        const Xchire_insert = await Xchire_sql`
            INSERT INTO accounts (
                referenceid, manager, tsm, companyname, contactperson, contactnumber,
                emailaddress, typeclient, address, deliveryaddress, area, status, date_created
            ) VALUES (
                ${referenceid},
                ${manager || null},
                ${tsm || null},
                ${companyname},
                ${contactperson},
                ${contactnumber},
                ${emailaddress},
                ${typeclient},
                ${address},
                ${deliveryaddress},
                ${area},
                ${status},
                NOW()
            ) RETURNING *;
        `;
        return { success: true, data: Xchire_insert };
    } catch (Xchire_error: any) {
        console.error("Error inserting account:", Xchire_error);
        return { success: false, error: Xchire_error.message || "Failed to add account." };
    }
}

// POST handler
export async function POST(req: Request) {
    try {
        const Xchire_body = await req.json();
        const { referenceid, data } = Xchire_body;

        if (!referenceid || !data || data.length === 0) {
            return NextResponse.json(
                { success: false, error: "Missing referenceid or data." },
                { status: 400 }
            );
        }

        let insertedCount = 0;

        for (const account of data) {
            const Xchire_result = await create(
                account.referenceid,
                account.manager || null,
                account.tsm || null,
                account.companyname,
                account.contactperson,
                account.contactnumber,
                account.emailaddress,
                account.typeclient,
                account.address,
                account.deliveryaddress,
                account.area,
                account.status
            );

            if (Xchire_result.success) {
                insertedCount++;
            } else {
                console.error("Failed to insert account:", Xchire_result.error);
            }
        }

        return NextResponse.json({
            success: true,
            insertedCount,
            message: `${insertedCount} records imported successfully!`,
        });
    } catch (Xchire_error: any) {
        console.error("Error in POST /api/importAccounts:", Xchire_error);
        return NextResponse.json(
            { success: false, error: Xchire_error.message || "Internal Server Error" },
            { status: 500 }
        );
    }
}
