import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import React, { forwardRef } from "react";
import {
    userFormAgeDescription,
    userFormAgeLabel,
    userFormPersonaLabel,
    userFormPersonaPlaceholder,
} from "@/lib/data";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
interface GeneralUserFormProps {
    selectedUser?: IUser;
    heading?: React.ReactNode;
    onSave?: (values: any, userType: "doctor" | "user", userId: string) => void;
    onClickCallback: () => void;
    userId: string;
    disabled?: boolean;
}


export const UserSettingsSchema = z.object({
    modules: z
        .array(z.enum(["math", "science", "spelling", "general_trivia"]))
        .refine((value) => value.some((item) => item), {
            message: "You have to select at least one item.",
        }),
});

export type GeneralUserInput = z.infer<typeof UserSettingsSchema>;

const GeneralUserForm = ({ selectedUser, onSave, onClickCallback, userId, heading, disabled }: GeneralUserFormProps) => {
    const form = useForm<GeneralUserInput>({
        defaultValues: {},
    });

    async function onSubmit(values: z.infer<typeof UserSettingsSchema>) {
        onSave && onSave(values, "user", userId);
    }

    const handleSave = () => {
        onSave && onSave(form.getValues(), "user", userId);
        onClickCallback();
    };

    return (
        <Form {...form}>
            <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="flex flex-col gap-8 mb-4"
            >
                {heading}
                <section className="space-y-4">
                    <h2 className="text-lg font-semibold border-b border-gray-200 pb-2">
                        Basic Info
                    </h2>
                </section>
                <Button
                variant="default"
                className="rounded-full w-fit mt-4 flex flex-row items-center gap-2"
                size="sm"
                onClick={handleSave}
                type="submit"
                disabled={disabled}
            >
                {disabled ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Save settings</span>}
            </Button>
            </form>
        </Form>
    );
};

export default GeneralUserForm;