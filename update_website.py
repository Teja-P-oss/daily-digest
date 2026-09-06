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
    repo_dir = script_dir.parent
    today_str = datetime.datetime.now().strftime("%Y-%m-%d")
    
    prompt = f"""
    Generate today's daily reading digest for a user interested in ISP, Camera Architecture, and Semiconductors.
    
    1. Fetch brief India and World news.
    2. Generate 3 research paper recommendations (1 in domain, 1 tech AI/ML, 1 out-of-domain). Include a summary, a 'why you should read this' takeaway, and a link.
    3. Get 5 top US stocks and 5 top Indian stocks.
    
    IMPORTANT: You do not need to, and should not, read any past daily digest files. Only generate new content for today.
    
    Format everything into the JSON structure required for the website and save it to this new file:
    {repo_dir}/daily-digest/data/{today_str}.json
    
    Next, update the {repo_dir}/daily-digest/data/index.json file. It contains a JSON array of date strings. Prepend "{today_str}" to the array if it is not already there.
    
    After saving the files, use your run_command tool to run these git commands in {repo_dir}:
    git add daily-digest/data/
    git commit -m "Automated AI Agent Update: Daily Digest {today_str}"
    git push
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
