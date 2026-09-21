import Link from "next/link";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Check,
  Link2,
  MessageCircle,
  Monitor,
  MousePointer2,
  Video,
} from "lucide-react";
import { Header } from "@/components/header";
import { Footer } from "@/components/ui";
import { Recorder } from "@/components/recorder";

export default function Home() {
  return (
    <>
      <Header marketing />
      <main id="main">
        <section className="hero">
          <div className="hero-icon" aria-hidden="true">
            <Video size={37} strokeWidth={2.3} fill="currentColor" />
          </div>
          <h1>
            Explain it once.
            <br />
            Share it instantly.
          </h1>
          <p>
            Less back-and-forth. More “got it.”
            <br />
            Bring your ideas to life with a simple screen recording.
          </p>
          <div className="hero-actions">
            <Link className="button button-dark button-large" href="/record">
              <span className="record-dot" /> Record a video{" "}
              <ArrowUpRight size={18} />
            </Link>
            <a className="button button-outline button-large" href="#try-clip">
              Try it out <ArrowDown size={18} />
            </a>
          </div>
          <div className="hero-footnote">
            <span>
              <Check size={14} /> No installation
            </span>
            <span>
              <Check size={14} /> Right in your browser
            </span>
          </div>
        </section>
        <section
          className="product-section"
          id="try-clip"
          aria-label="Try the Clip recorder"
        >
          <div className="product-caption">
            <span>
              <span className="tiny-square" /> LESS MEETING. MORE MEANING.
            </span>
            <span>
              Meet your new way to explain <ArrowDown size={15} />
            </span>
          </div>
          <div className="product-stage">
            <div className="product-window">
              <div className="window-bar">
                <div className="window-dots">
                  <i />
                  <i />
                  <i />
                </div>
                <span>
                  <Video size={13} /> clip / new recording
                </span>
                <span className="window-private">
                  <span /> Private by default
                </span>
              </div>
              <Recorder compact />
            </div>
            <div className="stage-label">
              <MousePointer2 size={15} /> Go ahead. It actually records.
            </div>
          </div>
        </section>
        <section className="how-section" id="how-it-works">
          <div className="section-intro">
            <span className="eyebrow">FROM THOUGHT TO UNDERSTOOD</span>
            <h2>
              Big ideas.
              <br />
              Small learning curve.
            </h2>
            <p>
              A quick walkthrough, a thoughtful update,
              <br />
              or that thing that’s just easier to show.
            </p>
          </div>
          <div className="steps-grid">
            <article>
              <div className="step-icon">
                <Monitor size={27} strokeWidth={1.5} />
              </div>
              <span className="step-number">01 / RECORD</span>
              <h3>Show what you mean.</h3>
              <p>
                Pick a screen, turn on your microphone, and talk it through.
                Pause whenever you need a moment.
              </p>
            </article>
            <article>
              <div className="step-icon">
                <Link2 size={27} strokeWidth={1.5} />
              </div>
              <span className="step-number">02 / SHARE</span>
              <h3>Send a little clarity.</h3>
              <p>
                Review your clip, upload it, and share an unlisted link. Your
                viewer can watch on their own time.
              </p>
            </article>
            <article>
              <div className="step-icon">
                <MessageCircle size={27} strokeWidth={1.5} />
              </div>
              <span className="step-number">03 / CONNECT</span>
              <h3>Keep the context.</h3>
              <p>
                Bring feedback to the exact moment with timestamped comments.
                Less guessing, better conversations.
              </p>
            </article>
          </div>
        </section>
        <section className="closing-cta">
          <div>
            <span className="eyebrow">YOU’VE GOT SOMETHING TO SHOW.</span>
            <h2>Make it a clip.</h2>
          </div>
          <Link className="button button-dark button-large" href="/record">
            Let’s record <ArrowRight size={19} />
          </Link>
        </section>
      </main>
      <Footer />
    </>
  );
}
