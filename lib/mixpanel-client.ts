"use client"
import mixpanel from "mixpanel-browser"

const mixpanelToken = process.env.NEXT_PUBLIC_MIXPANEL_TOKEN

if (mixpanelToken) {
  mixpanel.init(mixpanelToken, {
    debug: true,
    track_pageview: true,
    persistence: "localStorage",
    ignore_dnt: true,
  })
}

export const Mixpanel = {
  identify: (id: string) => {
    if (mixpanelToken) {
      mixpanel.identify(id)
    }
  },
  alias: (id: string) => {
    if (mixpanelToken) {
      mixpanel.alias(id)
    }
  },
  track: (name: string, props?: object) => {
    if (mixpanelToken) {
      mixpanel.track(name, props)
    }
  },
  people: {
    set: (props: object) => {
      if (mixpanelToken) {
        mixpanel.people.set(props)
      }
    },
  },
}
