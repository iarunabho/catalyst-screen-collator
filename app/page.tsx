'use client'

import { useEffect } from 'react'
import CourseProcessor from "../course-processor"

export default function Page() {
  useEffect(() => {
    // Mixpanel.track("Page View")
  }, [])
  return <CourseProcessor />
}
