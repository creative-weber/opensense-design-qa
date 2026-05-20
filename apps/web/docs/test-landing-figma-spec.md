# Test Landing Figma Spec

Purpose: baseline design reference for audit report testing.

## Frame details
- Frame name: Test Landing Frame
- Size: 1440x1800
- Export: `public/figma/test-landing-frame.svg`
- Intended viewport: desktop (1440x900)

## Design tokens
- Background: #F6F8FB
- Primary brand: #0B5FFF
- Hero gradient: #0B5FFF to #0A2D88
- Text primary: #0F172A
- Text secondary: #475569
- Card border: #D7DFEA

## Section order
1. Top navigation card
2. Hero section with CTA and score card
3. Three feature cards
4. Pricing block

## Audit test URLs
- Website URL: http://localhost:3000/fixtures/test-landing
- Figma URL: http://localhost:3000/figma/test-landing-frame.svg

## Non-happy-path mismatch test
- Website URL: http://localhost:3000/fixtures/test-landing
- Figma URL: http://localhost:3000/figma/test-landing-mismatch-frame.svg
- Expected result: meaningful layout, color, typography, and content mismatches in audit output.

## Notes
- The landing page intentionally follows the same layout and copy as the frame so the audit has a stable, repeatable test pair.
- If you need stronger diff signals, adjust spacing or text size in the web page only.
