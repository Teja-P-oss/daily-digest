import asyncio
import sys
import os
import datetime
from pathlib import Path
from google.antigravity import Agent, LocalAgentConfig, CapabilitiesConfig

async def main():
    print("Initializing Antigravity Agent for scalable website update...")
    
    config = LocalAgentConfig(
        system_instructions="You are an expert AI agent that curates high-quality technical digests. You have the ability to run shell commands to push code and edit files.",
        capabilities=CapabilitiesConfig()
    )
    
    script_dir = Path(__file__).parent.resolve()
    today_str = datetime.datetime.now().strftime("%Y-%m-%d")
    
    prompt = f"""
    Every day at 7:00 PM India Standard Time (Asia/Kolkata), perform the following workflow automatically.

    You are responsible for generating and publishing the day's **Daily Intelligence** briefing to my deployed website.

    IMPORTANT:
    - Do the research yourself using current web sources.
    - Do NOT reuse yesterday's information unless it is still materially relevant.
    - The briefing must reflect information available on the day it is generated.
    - After generating the briefing, publish it to the website/database using the application's existing API/database/content-ingestion mechanism.
    - Do not merely output the briefing in chat.
    - Verify that the newly published entry is accessible on the deployed website.
    - If publishing fails, diagnose and fix the issue where possible, then retry.
    - Never create duplicate entries for the same date. If today's entry already exists, update it rather than creating another one.

    # USER PROFILE / LEARNING PRIORITY

    Tailor the learning content to my professional background.

    My strongest areas are:

    - Camera architecture
    - Mobile camera systems
    - Image Signal Processors (ISP)
    - Display Processing Units (DPU)
    - Image processing
    - Computational photography
    - Computational imaging
    - Image/video quality
    - Multi-frame HDR
    - Noise reduction
    - Dithering
    - Error diffusion
    - Super-resolution
    - Deep-learning-based image processing
    - Computer vision
    - Mobile SoCs
    - Semiconductor industry
    - Hardware/software co-design
    - Embedded systems
    - Efficient algorithms
    - C/C++
    - Python
    - ML/AI for mobile and edge devices
    - Hardware acceleration
    - Memory optimization
    - Power optimization

    My goal is to continuously improve technically and stay ahead of important developments in camera technology, computer vision, AI/ML and semiconductor technology.

    LEARNING IS MUCH MORE IMPORTANT THAN NEWS.

    Target approximately 1 hour of reading at medium reading speed.

    # DAILY STRUCTURE

    Publish the briefing using this exact high-level structure:

    1. TECHNICAL PAPER OF THE DAY
    2. AI / ML / COMPUTER SCIENCE PAPER
    3. OUTSIDE-MY-DOMAIN PAPER
    4. INDIA — VERY BRIEF
    5. WORLD — VERY BRIEF
    6. MARKETS — VERY BRIEF
    7. TODAY'S TAKEAWAYS

    The first three sections should contain the majority of the reading material.

    ---

    # 1. TECHNICAL PAPER OF THE DAY

    Find ONE high-quality research paper that is particularly relevant to my technical background.

    Prefer papers published recently, especially within the last 1–2 years, unless an older paper is exceptionally important.

    Search broadly across:

    - Google Scholar
    - arXiv
    - IEEE
    - ACM
    - CVPR
    - ICCV
    - ECCV
    - NeurIPS
    - ICML
    - ICLR
    - SIGGRAPH
    - SPIE
    - Nature
    - Science
    - relevant semiconductor conferences
    - relevant industry research publications

    Potential subjects include:

    Camera/ISP:
    - ISP architectures
    - computational photography
    - computational imaging
    - image signal processing
    - camera pipelines
    - image quality
    - HDR
    - noise reduction
    - demosaicing
    - denoising
    - sharpening
    - tone mapping
    - color processing
    - image enhancement
    - video processing
    - multi-frame processing

    Mobile/edge:
    - mobile vision
    - efficient neural networks
    - edge AI
    - hardware acceleration
    - NPU/ISP co-design
    - memory-efficient algorithms
    - low-power ML
    - mobile SoCs

    Other relevant areas:
    - computer vision
    - super-resolution
    - image restoration
    - neural rendering
    - generative vision
    - efficient transformers
    - vision-language models
    - hardware/software co-design

    For the selected paper provide:

    TITLE

    AUTHORS

    YEAR

    CONFERENCE/JOURNAL

    DIRECT PAPER LINK

    GOOGLE SCHOLAR LINK, if available

    Then explain:

    ### What problem does it solve?
    Explain the problem clearly.

    ### Why is the problem difficult?
    Explain the technical challenge.

    ### Core idea
    Explain the central insight.

    ### How does it work?
    Walk through the method/architecture.

    ### Results
    Give the most important quantitative results where available.

    ### Why should I care?
    Relate it specifically to mobile cameras, ISP architecture, image quality, hardware efficiency, or my other relevant experience.

    ### What can I learn from it?
    Give 3–5 concrete lessons.

    ### Concepts to remember
    End with a small list of concepts I should remember.

    Do not merely summarize the abstract.

    I want to understand the paper well enough that I could discuss the main idea with another engineer.

    ---

    # 2. AI / ML / COMPUTER SCIENCE PAPER

    Find ONE important recent paper from the broader world of:

    - Artificial intelligence
    - Machine learning
    - Computer science
    - Computer vision
    - Generative AI
    - Large language models
    - AI agents
    - Reinforcement learning
    - ML systems
    - AI infrastructure
    - efficient AI
    - AI hardware
    - emerging CS research

    This paper should ideally expose me to something I am not already deeply familiar with.

    Include:

    - Title
    - Authors
    - Date
    - Venue
    - Direct paper link
    - Problem
    - Key idea
    - Method
    - Results
    - Why it matters
    - What I should learn
    - 3–5 key takeaways

    Prioritize genuinely influential or technically interesting research rather than papers selected simply because they are popular online.

    ---

    # 3. OUTSIDE-MY-DOMAIN PAPER

    This section is specifically for intellectual breadth.

    Every day find ONE interesting research paper from a field substantially outside my normal technical domain.

    Rotate among fields such as:

    - Biology
    - Neuroscience
    - Psychology
    - Physics
    - Mathematics
    - Astronomy
    - Chemistry
    - Materials science
    - Economics
    - Linguistics
    - Sociology
    - History
    - Arts
    - Anthropology
    - Earth science
    - Climate science

    Avoid repeatedly choosing adjacent technology topics.

    For example, if today's first two papers are about computer vision and AI, the third paper could be about:

    - how memories form in the brain
    - an unusual mathematical theorem
    - a physics discovery
    - evolutionary biology
    - human perception
    - astronomy
    - behavioral economics
    - music cognition
    - materials science

    Explain it in an engaging but technically accurate manner.

    Include:

    - Paper title
    - Authors
    - Field
    - Direct paper link
    - Question
    - Method
    - Discovery
    - Why it is interesting
    - One surprising takeaway

    The purpose is to make me intellectually broader.

    ---

    # 4. INDIA NEWS

    Keep this VERY brief.

    Maximum approximately 5 important items.

    Prioritize:

    - major government/policy developments
    - economy
    - technology
    - semiconductor industry
    - major business developments
    - science
    - infrastructure
    - geopolitics involving India
    - developments that could materially affect India

    For each:

    HEADLINE
    1–3 sentence explanation
    Why it matters, if necessary

    Do not include trivial news, celebrity news, routine political statements, or clickbait.

    ---

    # 5. WORLD NEWS

    Keep this VERY brief.

    Maximum approximately 5 important items.

    Prioritize:

    - geopolitics
    - global economy
    - technology
    - AI
    - semiconductor industry
    - science
    - major policy changes
    - major international events

    Again, focus on significance rather than volume.

    ---

    # 6. MARKETS

    This should take approximately 3–5 minutes to read.

    Provide:

    ## US — TOP 5

    For each stock:

    - Company / ticker
    - What happened today
    - Why it is interesting
    - One-line thesis
    - Main risk

    ## INDIA — TOP 5

    Same format.

    Selection should consider:

    - today's price movement
    - earnings
    - company announcements
    - sector developments
    - macroeconomic events
    - valuation
    - analyst expectations where reliable
    - unusual volume/activity
    - important catalysts

    Do NOT simply select the largest companies every day.

    The goal is to identify the 5 most interesting stocks to research that day.

    Clearly distinguish:

    - long-term opportunity
    - short-term catalyst
    - speculative/high-risk idea

    Do not present these as guaranteed investment recommendations.

    ---

    # 7. TODAY'S TAKEAWAYS

    End with:

    ## 5 THINGS TO REMEMBER TODAY

    Give me five concise ideas from the day's briefing.

    Then:

    ## ONE THING TO EXPLORE FURTHER

    Choose the single concept/paper/news item that is most worth spending additional time on.

    ---

    # WRITING STYLE

    The website is a personal learning tool.

    Write like an excellent technical mentor.

    Do NOT write like a newspaper.

    Use:

    - clear explanations
    - technical depth where useful
    - intuitive analogies
    - diagrams/structured explanations where the website supports them
    - equations when useful
    - concise bullet points
    - highlighted takeaways

    Avoid:

    - filler
    - generic motivational statements
    - excessive news
    - repetitive explanations
    - SEO-style writing
    - sensational headlines

    Assume I am a technically experienced software/semiconductor engineer.

    Do not oversimplify technical concepts, but explain unfamiliar concepts clearly.

    ---

    # SOURCE QUALITY

    Use primary sources whenever possible.

    For papers, prioritize the actual paper over blogs discussing the paper.

    For news, prioritize reputable journalism and official sources.

    For market information, use current reliable financial/market sources.

    Every paper MUST have a clickable direct paper link.

    Where possible also provide a Google Scholar link.

    Do not fabricate papers, authors, results, links, citations, stock prices, or statistics.

    If a claim cannot be verified, say so.

    ---

    # WEBSITE PUBLISHING

    After generating the briefing:

    1. Convert it into the website's existing content/data format (JSON).
    2. Format everything into EXACTLY this JSON structure and save it to this new file:
       {script_dir}/data/{today_str}.json
       
       JSON STRUCTURE:
       {{
         "news": {{
           "india": "HTML string with bullet points or paragraphs",
           "world": "HTML string with bullet points or paragraphs"
         }},
         "papers": {{
           "domain": {{
             "title": "Title",
             "authors": "Authors",
             "year": "Year",
             "venue": "Conference/Journal",
             "link": "URL",
             "scholar": "URL or null",
             "problem": "Problem solved",
             "difficulty": "Why difficult",
             "idea": "Core idea",
             "method": "How it works",
             "results": "Results",
             "care": "Why should I care",
             "learn": ["Lesson 1", "Lesson 2", "Lesson 3"],
             "concepts": ["Concept 1", "Concept 2"]
           }},
           "tech": {{
             "title": "Title",
             "authors": "Authors",
             "date": "Date",
             "venue": "Venue",
             "link": "URL",
             "problem": "Problem",
             "idea": "Key idea",
             "method": "Method",
             "results": "Results",
             "matters": "Why it matters",
             "learn": "What I should learn",
             "takeaways": ["Takeaway 1", "Takeaway 2"]
           }},
           "random": {{
             "title": "Title",
             "authors": "Authors",
             "field": "Field",
             "link": "URL",
             "question": "Question",
             "method": "Method",
             "discovery": "Discovery",
             "interesting": "Why it is interesting",
             "takeaway": "Surprising takeaway"
           }}
         }},
         "stocks": {{
           "us": [
             {{"symbol": "TICKER", "price": "$150.00", "change": 1.5, "reason": "What happened", "thesis": "One-line thesis", "risk": "Main risk"}}
           ],
           "india": [
             {{"symbol": "TICKER", "price": "₹2500.00", "change": -0.5, "reason": "What happened", "thesis": "One-line thesis", "risk": "Main risk"}}
           ]
         }},
         "takeaways": {{
           "remember": ["Fact 1", "Fact 2", "Fact 3", "Fact 4", "Fact 5"],
           "explore": "Topic to explore further"
         }}
       }}
       
    3. Next, update the {script_dir}/data/index.json file. It contains a JSON array of date strings. Prepend "{today_str}" to the array if it is not already there.
    4. Set the publication date to the current date in IST.
    5. After saving the files, use your run_command tool to run these git commands in {script_dir}:
       git add data/
       git commit -m "Automated AI Agent Update: Daily Digest {today_str}"
       git push
    6. Verify the published page.
    7. Make sure all paper/source links work.
    8. Make sure no previous day's content was accidentally overwritten.
    9. Ensure there is only ONE briefing for today's date.

    ---

    # FAILURE HANDLING

    If research fails:

    - retry with another reliable source.

    If a paper link fails:

    - find the official paper page or another authoritative copy.

    If publishing fails:

    - inspect the application's API/database/configuration
    - diagnose the error
    - fix it if possible
    - retry publication

    If the website is unavailable:

    - preserve the generated briefing
    - report the failure
    - do not silently discard the briefing

    If some information cannot be verified, explicitly label it as uncertain.

    ---

    # FINAL VERIFICATION

    Before considering the task complete, verify:

    [ ] Today's date is correct in IST
    [ ] Technical paper is relevant to my background
    [ ] AI/CS paper is genuinely recent/important
    [ ] Outside-domain paper is genuinely outside my normal expertise
    [ ] Paper links work
    [ ] News is current
    [ ] Stock information is current
    [ ] Website received today's briefing
    [ ] Homepage shows today's briefing
    [ ] Archive contains today's briefing
    [ ] No duplicate entry exists
    [ ] Previous briefings remain intact

    The final result should be a polished daily learning experience, not merely a collection of links.

    Most importantly:

    **RESEARCH → WRITE → PUBLISH → VERIFY.**
    """
    
    async with Agent(config) as agent:
        print("Agent spawned. Waiting for it to complete the tasks...\n")
        response = await agent.chat(prompt)
        
        async for token in response:
            sys.stdout.write(token)
            sys.stdout.flush()
        print("\n\nUpdate process completed successfully! 🎉")

if __name__ == "__main__":
    asyncio.run(main())
