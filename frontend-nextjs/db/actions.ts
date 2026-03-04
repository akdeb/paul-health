import { SupabaseClient } from "@supabase/supabase-js";

export const createAction = async (
    supabase: SupabaseClient,
    {
        userId,
        type,
        metadata = {},
        sessionTime = 0,
        jobId = null,
    }: {
        userId: string;
        type: ActionType;
        metadata?: ActionMetadata;
        sessionTime?: number;
        jobId?: string | null;
    },
): Promise<IAction | null> => {
    const { data, error } = await supabase
        .from("actions")
        .insert({
            user_id: userId,
            type,
            metadata,
            session_time: sessionTime,
            job_id: jobId,
        })
        .select()
        .single();

    if (error) {
        console.log("error in createAction", error);
        return null;
    }

    return data as IAction;
};

export const updateActionSessionTime = async (
    supabase: SupabaseClient,
    actionId: string,
    sessionTime: number,
): Promise<boolean> => {
    const { error } = await supabase
        .from("actions")
        .update({ session_time: sessionTime })
        .eq("action_id", actionId);

    if (error) {
        console.log("error in updateActionSessionTime", error);
        return false;
    }

    return true;
};

export const getActionsByUserId = async (
    supabase: SupabaseClient,
    userId: string,
    {
        limit = 20,
        offset = 0,
    }: {
        limit?: number;
        offset?: number;
    } = {},
): Promise<IAction[]> => {
    const { data, error } = await supabase
        .from("actions")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

    if (error) {
        console.log("error in getActionsByUserId", error);
        return [];
    }

    return (data ?? []) as IAction[];
};

export const getActionById = async (
    supabase: SupabaseClient,
    actionId: string,
    userId?: string,
): Promise<IAction | null> => {
    let query = supabase
        .from("actions")
        .select("*")
        .eq("action_id", actionId);

    if (userId) {
        query = query.eq("user_id", userId);
    }

    const { data, error } = await query.single();

    if (error) {
        console.log("error in getActionById", error);
        return null;
    }

    return data as IAction;
};
