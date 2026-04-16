import { NextResponse } from 'next/server';
import { setUserContextCache } from '@/lib/cache';
import { createClient } from '@/utils/supabase/server';

export async function POST(req: Request) {
    try {
        const { authToken } = await req.json();
        const supabase = await createClient({
            global: {
                headers: {
                    Authorization: `Bearer ${authToken}`,
                },
            },
        });

        const { data: user, error: userError } = await supabase.auth.getUser();

        if (userError) {
            return NextResponse.json(
                { error: userError.message },
                { status: 401 }
            );
        }

        const { data: updatedDevices, error } = await supabase.from('devices').update({
            is_ota: false,
        }).eq('user_id', user.user.id).select();

        if (error || !updatedDevices || updatedDevices.length === 0) {
            return NextResponse.json(
                { error: error?.message ?? 'Failed to update OTA status' },
                { status: 500 }
            );
        }

        if (user.user.email) {
            const { data: dbUser, error: userContextError } = await supabase
                .from('users')
                .select(
                    [
                        '*',
                        'language:languages(name)',
                        'personality:personalities!users_personality_id_fkey(*)',
                        'device:devices!users_device_id_fkey(*)',
                        'patient:patients!users_patient_id_fkey(*)',
                    ].join(',')
                )
                .eq('user_id', user.user.id)
                .single();

            if (!userContextError && dbUser) {
                await setUserContextCache(user.user.email, dbUser as unknown as IUser);
            }
        }

        return NextResponse.json({ success: true, updated: true });
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Internal server error' },
            { status: 500 }
        );
    }
}
