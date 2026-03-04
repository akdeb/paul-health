import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { createClient } from "@/utils/supabase/server";
import { createAction } from "@/db/actions";

const ALGORITHM = "HS256";
const skipDeviceRegistration =
    process.env.NEXT_PUBLIC_SKIP_DEVICE_REGISTRATION === "True";

interface TokenPayload {
    [key: string]: any;
}

const createSupabaseToken = (
    jwtSecretKey: string,
    data: TokenPayload,
    // Set expiration to null for no expiration, or use a very large number like 10 years
    expireDays: number | null = 3650, // Default to 10 years
): string => {
    const toEncode = {
        aud: "authenticated",
        role: "authenticated",
        sub: data.user_id,
        email: data.email,
        // Only include exp if expireDays is not null
        ...(expireDays && {
            exp: Math.floor(Date.now() / 1000) + (expireDays * 86400),
        }),
        user_metadata: {
            ...data,
        },
    };

    const encodedJwt = jwt.sign(toEncode, jwtSecretKey, {
        algorithm: ALGORITHM,
    });
    return encodedJwt;
};

const getUserByMacAddress = async (macAddress: string) => {
    const supabase = await createClient();
    const { data, error } = await supabase.from("devices").select(
        "*, user:user_id(*, patient:patients!users_patient_id_fkey(timezone))",
    ).eq("mac_address", macAddress).single();
    if (error) {
        throw new Error(error.message);
    }
    return data.user;
};

const getDevUser = async () => {
    const supabase = await createClient();
    const { data, error } = await supabase.from("users").select(
        "*, patient:patients!users_patient_id_fkey(timezone)",
    ).eq(
        "email",
        "admin@paulhealth.com",
    ).single();
    if (error) {
        throw new Error(error.message);
    }
    return data;
};

export async function GET(req: Request) {
    try {
        const supabase = await createClient();
        const { searchParams } = new URL(req.url);
        const macAddress = searchParams.get("macAddress");

        if (!macAddress) {
            return NextResponse.json(
                { error: "MAC address is required" },
                { status: 400 },
            );
        }

        /**
         * If `NEXT_PUBLIC_SKIP_DEVICE_REGISTRATION` is true, we use the default dev user.
         * Otherwise, we use the user by given by the mac address.
         *
         * Steps to register your device:
         * 1: Register the device `mac_address` and `user_code` in the `devices` tables.
         * 2: Make sure the user adds the `user_code` to their account in Settings to link the device to their `user_id`.
         * 3: When `NEXT_PUBLIC_SKIP_DEVICE_REGISTRATION` is false, we then fetch the user by `mac_address`.
         */
        let user;
        if (skipDeviceRegistration) {
            user = await getDevUser();
        } else {
            user = await getUserByMacAddress(macAddress);
        }

        if (!user) {
            return NextResponse.json(
                { error: "User not found" },
                { status: 400 },
            );
        }

        const payload = {
            email: user.email,
            user_id: user.user_id,
            created_time: new Date(),
        };

        const token = createSupabaseToken(
            process.env.JWT_SECRET_KEY!,
            payload,
            null,
        );

        const timezone = user.patient?.timezone ?? "UTC";

        await Promise.all([
            createAction(supabase, {
                userId: user.user_id,
                type: "device_event",
                metadata: { text: "Wifi connected" },
                sessionTime: 0,
                jobId: null,
            }),
            createAction(supabase, {
                userId: user.user_id,
                type: "device_event",
                metadata: { text: "Device registered" },
                sessionTime: 0,
                jobId: null,
            }),
        ]);

        return NextResponse.json({ token, timezone });
    } catch (error) {
        return NextResponse.json(
            {
                error: error instanceof Error
                    ? error.message
                    : "Internal server error",
            },
            { status: 500 },
        );
    }
}
