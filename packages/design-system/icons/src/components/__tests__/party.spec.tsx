  import * as React from "react"
  import { cleanup, render, screen } from "@testing-library/react"

  import Party from "../party"

  describe("Party", () => {
    it("should render the icon without errors", async () => {
      render(<Party data-testid="icon" />)


      const svgElement = screen.getByTestId("icon")

      expect(svgElement).toBeInTheDocument()

      cleanup()
    })
  })