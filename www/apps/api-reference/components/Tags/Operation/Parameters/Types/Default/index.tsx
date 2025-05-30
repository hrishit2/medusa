import type { OpenAPI } from "types"
import TagOperationParametersDescription from "../../Description"
import clsx from "clsx"
import TagOperationParametersName from "../../Name"

export type TagOperationParametersDefaultProps = {
  name?: string
  schema: OpenAPI.SchemaObject
  isRequired?: boolean
  className?: string
  expandable?: boolean
}

const TagOperationParametersDefault = ({
  name,
  schema,
  isRequired,
  className,
  expandable = false,
}: TagOperationParametersDefaultProps) => {
  return (
    <div
      className={clsx(
        "my-0.5 inline-flex flex-col justify-between gap-0.25",
        expandable && "w-[calc(100%-16px)]",
        !expandable && "w-full pl-1",
        className
      )}
    >
      {name && (
        <TagOperationParametersName
          name={name}
          isRequired={isRequired}
          schema={schema}
        />
      )}
      <TagOperationParametersDescription schema={schema} />
    </div>
  )
}

export default TagOperationParametersDefault
