"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import type { Label as LabelPrimitive } from "radix-ui"
import { Slot } from "radix-ui"
import {
  Controller,
  FormProvider,
  useFormContext,
  useFormState,
  useWatch,
  type Control,
  type ControllerProps,
  type FieldPath,
  type FieldValues,
  type FormProviderProps,
} from "react-hook-form"

import { Label } from "@/components/ui/label"

/**
 * `preRempli` : les valeurs du formulaire viennent de la base (une
 * modification). Chaque champ garde alors le fond `--input-fond-pre-rempli`
 * tant que l'utilisateur ne l'a pas changé — ce qu'il modifie se lit d'un
 * coup d'œil, et ce qui reste est ce que le serveur a enregistré.
 */
const ContextePreRempli = React.createContext(false)

function Form<TFieldValues extends FieldValues, TContext = unknown, TTransformedValues = TFieldValues>({
  preRempli = false,
  ...props
}: FormProviderProps<TFieldValues, TContext, TTransformedValues> & {
  preRempli?: boolean
}) {
  return (
    <ContextePreRempli.Provider value={preRempli}>
      <FormProvider {...props} />
    </ContextePreRempli.Provider>
  )
}

/** Une valeur venue de la base, et pas un champ laissé vide. */
function valeurRenseignee(valeur: unknown): boolean {
  if (valeur === null || valeur === undefined) return false
  if (typeof valeur === "string") return valeur.trim() !== ""
  if (Array.isArray(valeur)) return valeur.length > 0
  return true
}

type FormFieldContextValue<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> = {
  name: TName
}

const FormFieldContext = React.createContext<FormFieldContextValue>(
  {} as FormFieldContextValue
)

const FormField = <
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({
  ...props
}: ControllerProps<TFieldValues, TName>) => {
  return (
    <FormFieldContext.Provider value={{ name: props.name }}>
      <Controller {...props} />
    </FormFieldContext.Provider>
  )
}

const useFormField = () => {
  const fieldContext = React.useContext(FormFieldContext)
  const itemContext = React.useContext(FormItemContext)
  const { getFieldState } = useFormContext()
  const formState = useFormState({ name: fieldContext.name })
  const fieldState = getFieldState(fieldContext.name, formState)

  if (!fieldContext) {
    throw new Error("useFormField should be used within <FormField>")
  }

  const { id } = itemContext

  return {
    id,
    name: fieldContext.name,
    formItemId: `${id}-form-item`,
    formDescriptionId: `${id}-form-item-description`,
    formMessageId: `${id}-form-item-message`,
    ...fieldState,
  }
}

type FormItemContextValue = {
  id: string
}

const FormItemContext = React.createContext<FormItemContextValue>(
  {} as FormItemContextValue
)

function FormItem(props: React.ComponentProps<"div">) {
  const preRempli = React.useContext(ContextePreRempli)
  const { name } = React.useContext(FormFieldContext)
  // Deux composants plutôt qu'un test dans les hooks : l'ordre des hooks ne
  // change jamais d'un rendu à l'autre.
  return preRempli && name ? <FormItemPreRempli nom={name} {...props} /> : <CadreFormItem {...props} />
}

function FormItemPreRempli({ nom, ...props }: React.ComponentProps<"div"> & { nom: string }) {
  const { control } = useFormContext()
  return <CadreFormItem data-pre-rempli={usePreRempli(control, nom)} {...props} />
}

/**
 * Le champ `nom` porte encore la valeur venue de la base : renseignée, et pas
 * modifiée depuis. Pour un formulaire react-hook-form qui ne passe pas par
 * `<Form>` — on le pose en `data-pre-rempli` sur le champ.
 */
function usePreRempli<TFieldValues extends FieldValues>(
  control: Control<TFieldValues>,
  nom: FieldPath<TFieldValues>,
): boolean {
  const valeur = useWatch({ control, name: nom })
  const etat = useFormState({ control, name: nom })
  return !control.getFieldState(nom, etat).isDirty && valeurRenseignee(valeur)
}

/**
 * La même chose, pour un champ qui ne transmet pas `data-pre-rempli` à son
 * élément (`ChampTelephone`, un `Controller`) ou qui vit dans une boucle, où
 * un hook ne peut pas s'appeler. Sans boîte propre (`display: contents`) : la
 * mise en page ne bouge pas.
 */
function ZonePreRemplie<TFieldValues extends FieldValues>({
  control,
  nom,
  actif = true,
  children,
}: {
  control: Control<TFieldValues>
  nom: FieldPath<TFieldValues>
  /** Faux pour une création : les valeurs par défaut ne viennent pas de la base. */
  actif?: boolean
  children: React.ReactNode
}) {
  const preRempli = usePreRempli(control, nom)
  return (
    <div className="contents" data-pre-rempli={actif && preRempli}>
      {children}
    </div>
  )
}

function CadreFormItem({ className, ...props }: React.ComponentProps<"div">) {
  const id = React.useId()

  return (
    <FormItemContext.Provider value={{ id }}>
      <div
        data-slot="form-item"
        className={cn("grid gap-2", className)}
        {...props}
      />
    </FormItemContext.Provider>
  )
}

function FormLabel({
  className,
  ...props
}: React.ComponentProps<typeof LabelPrimitive.Root>) {
  const { error, formItemId } = useFormField()

  return (
    <Label
      data-slot="form-label"
      data-error={!!error}
      className={cn("data-[error=true]:text-destructive", className)}
      htmlFor={formItemId}
      {...props}
    />
  )
}

function FormControl({ ...props }: React.ComponentProps<typeof Slot.Root>) {
  const { error, formItemId, formDescriptionId, formMessageId } = useFormField()

  return (
    <Slot.Root
      data-slot="form-control"
      id={formItemId}
      aria-describedby={
        !error
          ? `${formDescriptionId}`
          : `${formDescriptionId} ${formMessageId}`
      }
      aria-invalid={!!error}
      {...props}
    />
  )
}

function FormDescription({ className, ...props }: React.ComponentProps<"p">) {
  const { formDescriptionId } = useFormField()

  return (
    <p
      data-slot="form-description"
      id={formDescriptionId}
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

function FormMessage({ className, ...props }: React.ComponentProps<"p">) {
  const { error, formMessageId } = useFormField()
  const body = error ? String(error?.message ?? "") : props.children

  if (!body) {
    return null
  }

  return (
    <p
      data-slot="form-message"
      id={formMessageId}
      className={cn("text-sm text-destructive", className)}
      {...props}
    >
      {body}
    </p>
  )
}

export {
  useFormField,
  Form,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
  FormField,
  usePreRempli,
  ZonePreRemplie,
}
