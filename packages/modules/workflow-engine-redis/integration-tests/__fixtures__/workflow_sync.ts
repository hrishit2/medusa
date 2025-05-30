import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { isPresent } from "@medusajs/framework/utils"

const step_1 = createStep(
  "step_1",
  jest.fn((input) => {
    input.test = "test"
    return new StepResponse(input, { compensate: 123 })
  }),
  jest.fn((compensateInput) => {
    if (!compensateInput) {
      return
    }

    return new StepResponse({
      reverted: true,
    })
  })
)

const step_2 = createStep(
  "step_2",
  jest.fn((input, context) => {
    if (isPresent(input)) {
      return new StepResponse({ notAsyncResponse: input.hey })
    }
  }),
  jest.fn((_, context) => {
    return new StepResponse({
      step: context.metadata.action,
      idempotency_key: context.metadata.idempotency_key,
      reverted: true,
    })
  })
)

const step_3 = createStep(
  "step_3",
  jest.fn((res) => {
    return new StepResponse({
      done: {
        inputFromSyncStep: res.notAsyncResponse,
      },
    })
  })
)

createWorkflow(
  {
    name: "workflow_sync",
    idempotent: true,
  },
  function (input) {
    step_1(input)

    const ret2 = step_2({ hey: "oh" })

    return new WorkflowResponse(step_3(ret2))
  }
)
