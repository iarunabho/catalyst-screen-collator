'use client'

import { useEffect } from 'react'
import CourseProcessor from "../course-processor"
import { Mixpanel } from "@/lib/mixpanel-client"

export default function Page() {
  useEffect(() => {
    Mixpanel.track("Page View")
  }, [])
  return <CourseProcessor />
}
