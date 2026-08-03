"""Seed initial users, default scoring rubric, and sample sessions/scores.

Idempotent -- skips records that already exist.
Run with: python scripts/seed_data.py
"""

import asyncio
import json
import sys
import uuid
from datetime import timedelta
from pathlib import Path

# Add backend root to path so 'app' package is importable
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import get_settings
from app.models.avatar_persona import AvatarPersona
from app.models.message import SessionMessage
from app.models.scenario import Scenario
from app.models.score import ScoreDetail, SessionScore
from app.models.service_config import ServiceConfig
from app.models.session import CoachingSession
from app.models.user import User
from app.services.auth import get_password_hash
from app.services.default_rubrics import ensure_default_f2f_rubric
from app.utils.datetime import utc_now_naive

settings = get_settings()

SEED_USERS = [
    {
        "username": "admin",
        "email": "admin@aicoach.com",
        "password": "admin123",
        "role": "admin",
        "full_name": "System Admin",
        "preferred_language": "zh-CN",
        "business_unit": "",
    },
    {
        "username": "user1",
        "email": "user1@aicoach.com",
        "password": "user123",
        "role": "user",
        "full_name": "Zhang Wei",
        "preferred_language": "zh-CN",
        "business_unit": "Oncology BU (肿瘤事业部)",
    },
    {
        "username": "user2",
        "email": "user2@aicoach.com",
        "password": "user123",
        "role": "user",
        "full_name": "Li Ming",
        "preferred_language": "zh-CN",
        "business_unit": "Hematology BU (血液事业部)",
    },
    {
        "username": "user3",
        "email": "user3@aicoach.com",
        "password": "user123",
        "role": "user",
        "full_name": "Wang Fang",
        "preferred_language": "en-US",
        "business_unit": "Solid Tumor BU (实体瘤事业部)",
    },
]


async def seed_default_rubric(session: AsyncSession, admin_user_id: str) -> None:
    """Seed a default F2F scoring rubric with 5 standard dimensions."""
    rubric = await ensure_default_f2f_rubric(session, admin_user_id)
    if rubric is None:
        print("  [skip] Default F2F rubric already exists")
        return
    print("  [created] Default F2F scoring rubric (5 dimensions, weights sum to 100)")


SAMPLE_CONVERSATIONS = [
    # Conversation 1: Zanubrutinib discussion with skeptical oncologist
    [
        (
            "user",
            "张教授，您好！感谢您在百忙之中抽出时间与我见面。我是百济神州的医学代表，今天想和您分享一下泽布替尼在CLL/SLL治疗中的最新临床数据。",
        ),
        (
            "assistant",
            "你好，请坐。我对BTK抑制剂有一定了解，目前我们科室主要使用伊布替尼。泽布替尼和伊布替尼相比有什么不同呢？我更关心的是实际临床获益。",
        ),
        (
            "user",
            "非常好的问题！ALPINE研究头对头比较了泽布替尼和伊布替尼在复发/难治性CLL/SLL患者中的疗效。结果显示泽布替尼的ORR达到78.3%，显著优于伊布替尼的62.5%。",
        ),
        (
            "assistant",
            "ORR的差异确实明显。但我更关心PFS和安全性数据，尤其是心脏相关的不良事件，这是我在使用伊布替尼时最担心的问题。",
        ),
        (
            "user",
            "您的关注非常专业。在ALPINE研究中，泽布替尼组的房颤/房扑发生率仅为2.5%，而伊布替尼组为10.1%。在PFS方面，中位随访28.1个月，泽布替尼组的PFS优势显著。",
        ),
        (
            "assistant",
            "心脏安全性数据确实很有说服力。那在其他不良反应方面呢？比如出血风险和感染率如何？",
        ),
        (
            "user",
            "在出血方面，泽布替尼的任何级别出血事件发生率为45.4%，低于伊布替尼的51.9%。严重出血事件的发生率也更低。在感染方面，两组相当，但泽布替尼组的3级以上感染略低。",
        ),
        (
            "assistant",
            "数据看起来不错。我有几位患者目前正在使用伊布替尼但出现了房颤，可以考虑换用泽布替尼。你能帮我安排一次科室内的学术分享会吗？",
        ),
    ],
    # Conversation 2: Tislelizumab quarterly update with cardiologist
    [
        (
            "user",
            "李教授，很高兴再次见到您！上次我们讨论了替雷利珠单抗在食管鳞癌中的数据，今天我想给您更新一下最新的长期随访结果。",
        ),
        (
            "assistant",
            "好的，我记得上次你提到了RATIONALE-302研究，长期随访的结果怎么样？我最近也在关注免疫治疗在消化道肿瘤中的进展。",
        ),
        (
            "user",
            "是的，RATIONALE-302研究的最新随访数据显示，"
            "替雷利珠单抗在PD-L1 TAP≥10%的患者中，"
            "中位OS达到了17.2个月，较化疗组的10.6个月有显著提升。",
        ),
        (
            "assistant",
            "OS数据确实可以。不过实际上我们科室遇到的患者往往合并心血管基础疾病，免疫治疗的心脏毒性是我比较担心的。",
        ),
        (
            "user",
            "这是非常重要的考量。从临床研究数据来看，替雷利珠单抗的心肌炎发生率低于1%，且大多数为1-2级。我们建议在治疗前进行基线心脏评估，包括心电图和肌钙蛋白检测。",
        ),
        ("assistant", "嗯，这个监测方案比较完善。那么在联合治疗方案方面有什么新的进展吗？"),
        (
            "user",
            "在联合化疗方面，RATIONALE-306研究显示替雷利珠单抗联合化疗作为一线治疗，显著改善了晚期NSCLC患者的PFS和OS，且安全性可控。",
        ),
        (
            "assistant",
            "好的，这些数据我会认真看一下。能否把最新的研究论文和处方信息发给我？下周我有一个MDT讨论会可以分享。",
        ),
    ],
    # Conversation 3: More detailed Zanubrutinib discussion
    [
        (
            "user",
            "王教授，您好！我是百济神州的医学代表。今天想与您分享泽布替尼在华氏巨球蛋白血症（WM）中的最新治疗进展。",
        ),
        (
            "assistant",
            "你好。WM的治疗选择确实有限，目前我们主要用利妥昔单抗联合化疗。BTK抑制剂在WM中的数据怎么样？",
        ),
        (
            "user",
            "ASPEN研究比较了泽布替尼和伊布替尼在WM患者中的疗效。泽布替尼组的VGPR率达到28.4%，高于伊布替尼组的19.2%。在MYD88突变患者中优势更为明显。",
        ),
        (
            "assistant",
            "VGPR率的提升有意义。WM患者通常需要长期治疗，那长期安全性如何？特别是血小板减少和中性粒细胞减少的情况。",
        ),
        (
            "user",
            "在长期安全性方面，泽布替尼表现出更好的耐受性。中性粒细胞减少的发生率与伊布替尼相当，但心脏事件、高血压和肌肉骨骼事件的发生率明显更低。中位治疗持续时间超过24个月。",
        ),
        (
            "assistant",
            "明白了。对于那些一线治疗后进展的WM患者，泽布替尼是一个值得考虑的选择。请帮我准备一些患者教育材料。",
        ),
    ],
    # Conversation 4: Conference-style shorter discussion
    [
        (
            "user",
            "教授，感谢您来参加今天的学术沙龙。我想简要介绍一下百济神州在血液肿瘤领域的最新研发进展。",
        ),
        (
            "assistant",
            "好的，请开始吧。我对百济神州的管线很感兴趣，尤其是在淋巴瘤和多发性骨髓瘤方面的布局。",
        ),
        (
            "user",
            "在淋巴瘤领域，泽布替尼已获批多个适应症，包括MCL、CLL/SLL、WM和MZL。全球注册研究覆盖超过5000名患者，是目前数据最丰富的新一代BTK抑制剂。",
        ),
        ("assistant", "全球化的注册研究确实是一个优势。最近有什么值得关注的新数据发布吗？"),
        (
            "user",
            "最值得关注的是泽布替尼在一线CLL治疗中的SEQUOIA研究数据。结果显示在初治CLL/SLL患者中，泽布替尼单药的24个月PFS率达到85%，显著优于苯达莫司汀联合利妥昔单抗方案。",
        ),
        (
            "assistant",
            "一线治疗的数据很重要，这可能会改变我们的临床实践。期待看到更长期的随访数据。",
        ),
    ],
]

# Rich strengths/weaknesses/suggestions per dimension level
DIMENSION_FEEDBACK = {
    "key_message": {
        "high": {
            "strengths": [
                {"text": "清晰传达了核心临床数据", "quote": "ALPINE研究ORR达到78.3%"},
                {"text": "关键信息传递逻辑连贯", "quote": "有序呈现疗效和安全性数据"},
            ],
            "weaknesses": [],
            "suggestions": ["可以更多关联患者实际获益场景"],
        },
        "mid": {
            "strengths": [
                {"text": "提及了主要临床数据", "quote": "引用了研究结果"},
            ],
            "weaknesses": [
                {"text": "部分关键信息遗漏", "quote": "未提及PFS长期随访数据"},
            ],
            "suggestions": ["建议使用结构化话术确保覆盖所有关键信息", "准备简洁的数据卡片辅助记忆"],
        },
        "low": {
            "strengths": [],
            "weaknesses": [
                {"text": "关键信息传递不完整", "quote": "遗漏了核心疗效数据"},
                {"text": "信息呈现缺乏逻辑", "quote": "数据呈现顺序混乱"},
            ],
            "suggestions": ["建议提前准备关键信息清单", "每次拜访前复习3个核心卖点"],
        },
    },
    "objection_handling": {
        "high": {
            "strengths": [
                {"text": "有效回应了安全性顾虑", "quote": "房颤发生率仅为2.5%，远低于伊布替尼"},
                {"text": "用数据支撑回应", "quote": "引用ALPINE研究头对头比较数据"},
            ],
            "weaknesses": [],
            "suggestions": ["继续保持用循证医学数据回应质疑的方式"],
        },
        "mid": {
            "strengths": [
                {"text": "能够识别并回应主要顾虑", "quote": "回应了心脏安全性问题"},
            ],
            "weaknesses": [
                {"text": "回应略显被动", "quote": "等待医生提问而非主动引导"},
            ],
            "suggestions": ["主动预判常见顾虑并提前准备回应", "使用FAB话术框架"],
        },
        "low": {
            "strengths": [],
            "weaknesses": [
                {"text": "未能有效回应质疑", "quote": "对安全性问题缺乏数据支持"},
                {"text": "面对异议时表现紧张", "quote": "回答犹豫不够自信"},
            ],
            "suggestions": ["熟练掌握竞品对比数据", "进行异议处理情景演练"],
        },
    },
    "communication": {
        "high": {
            "strengths": [
                {"text": "交流自然流畅", "quote": "能够根据医生反馈灵活调整话题"},
                {"text": "专业且有亲和力", "quote": "始终保持尊重和专业的沟通态度"},
            ],
            "weaknesses": [],
            "suggestions": ["可以适当增加开放式问题提高互动性"],
        },
        "mid": {
            "strengths": [
                {"text": "基本沟通礼仪良好", "quote": "开场白和结束语得体"},
            ],
            "weaknesses": [
                {"text": "互动性不足", "quote": "更多是单向信息传递"},
            ],
            "suggestions": ["多使用开放式问题引导对话", "注意观察医生的非语言反馈"],
        },
        "low": {
            "strengths": [],
            "weaknesses": [
                {"text": "沟通过于生硬", "quote": "照本宣科，缺乏互动"},
                {"text": "未能有效倾听", "quote": "忽略了医生的提问直接推进话术"},
            ],
            "suggestions": ["练习积极倾听技巧", "学习SPIN销售对话模型"],
        },
    },
    "product_knowledge": {
        "high": {
            "strengths": [
                {"text": "产品知识扎实全面", "quote": "准确引用临床数据和适应症信息"},
                {"text": "能够进行竞品比较", "quote": "清晰对比泽布替尼与伊布替尼的差异"},
            ],
            "weaknesses": [],
            "suggestions": ["持续关注最新研究进展和指南更新"],
        },
        "mid": {
            "strengths": [
                {"text": "基本产品信息掌握准确", "quote": "适应症和用法用量正确"},
            ],
            "weaknesses": [
                {"text": "竞品比较不够深入", "quote": "未能详细说明差异化优势"},
            ],
            "suggestions": ["深入学习头对头研究数据", "准备竞品比较速查表"],
        },
        "low": {
            "strengths": [],
            "weaknesses": [
                {"text": "产品知识薄弱", "quote": "数据引用不准确"},
                {"text": "无法回答深入的医学问题", "quote": "对临床细节问题含糊其辞"},
            ],
            "suggestions": ["系统学习产品培训材料", "参加内部医学知识培训"],
        },
    },
    "scientific_info": {
        "high": {
            "strengths": [
                {"text": "准确引用关键临床研究", "quote": "详细介绍ALPINE和SEQUOIA研究"},
                {"text": "数据引用精确", "quote": "准确报告了ORR、PFS等关键终点"},
            ],
            "weaknesses": [],
            "suggestions": ["可以增加真实世界研究数据的引用"],
        },
        "mid": {
            "strengths": [
                {"text": "能够引用主要研究名称", "quote": "提到了关键注册研究"},
            ],
            "weaknesses": [
                {"text": "数据细节不够精确", "quote": "部分数据点引用模糊"},
            ],
            "suggestions": ["准备研究数据速查卡", "关注最新学术会议报告"],
        },
        "low": {
            "strengths": [],
            "weaknesses": [
                {"text": "缺乏科学文献支持", "quote": "未引用任何具体研究数据"},
                {"text": "对研究设计理解不足", "quote": "混淆了研究终点和人群"},
            ],
            "suggestions": ["学习如何阅读和理解临床研究报告", "背诵3个核心研究的关键数据"],
        },
    },
}


async def seed_sessions(session: AsyncSession) -> None:
    """Seed 12 scored training sessions with messages, scores, and rich feedback.

    Creates 4 sessions per MR user (user1, user2, user3) spread over the last 30 days.
    Includes realistic conversation history and detailed scoring feedback.
    Idempotent: skips if coaching sessions already exist for seed users.
    """
    # Check if sessions already exist for seed users
    mr_usernames = ["user1", "user2", "user3"]
    users_result = await session.execute(select(User).where(User.username.in_(mr_usernames)))
    mr_users = list(users_result.scalars().all())
    if not mr_users:
        print("  [skip] No MR users found — run seed_users first")
        return

    # Check idempotency
    user_ids = [u.id for u in mr_users]
    existing_count_result = await session.execute(
        select(func.count())
        .select_from(CoachingSession)
        .where(CoachingSession.user_id.in_(user_ids))
    )
    if (existing_count_result.scalar() or 0) > 0:
        print("  [skip] Sessions already exist for seed users")
        return

    # Get active scenarios
    scenarios_result = await session.execute(
        select(Scenario).where(Scenario.status == "active").limit(4)
    )
    scenarios = list(scenarios_result.scalars().all())
    if not scenarios:
        print("  [skip] No active scenarios found — seed scenarios first")
        return

    # Session score templates per user (vary per user and session)
    score_templates = [
        # user1 (Zhang Wei) — improving over time
        [65, 70, 78, 85],
        # user2 (Li Ming) — steady performer
        [72, 75, 73, 80],
        # user3 (Wang Fang) — high performer
        [80, 82, 88, 90],
    ]

    day_offsets = [30, 20, 10, 2]  # days ago
    dimensions = [
        "key_message",
        "objection_handling",
        "communication",
        "product_knowledge",
        "scientific_info",
    ]
    now = utc_now_naive()
    session_count = 0

    for user_idx, user in enumerate(mr_users):
        scores_list = score_templates[user_idx % len(score_templates)]
        for sess_idx in range(4):
            scenario = scenarios[sess_idx % len(scenarios)]
            overall = scores_list[sess_idx]
            day_offset = day_offsets[sess_idx]
            started = now - timedelta(days=day_offset, hours=2)
            duration = 300 + (sess_idx * 150)  # 300, 450, 600, 750 seconds
            completed = started + timedelta(seconds=duration)
            passed = overall >= 70

            # Key messages status (simulate partial delivery based on score)
            key_msgs_raw = scenario.key_messages
            try:
                key_msgs = (
                    json.loads(key_msgs_raw) if isinstance(key_msgs_raw, str) else key_msgs_raw
                )
            except (json.JSONDecodeError, TypeError):
                key_msgs = ["关键信息1", "关键信息2", "关键信息3"]
            km_delivered = max(1, int(len(key_msgs) * (overall / 100.0)))
            km_status = []
            for km_idx, km in enumerate(key_msgs):
                delivered = km_idx < km_delivered
                km_status.append(
                    {
                        "message": km,
                        "delivered": delivered,
                        "detected_at": (started + timedelta(minutes=2 + km_idx * 3)).isoformat()
                        if delivered
                        else None,
                    }
                )

            cs_id = str(uuid.uuid4())
            cs = CoachingSession(
                id=cs_id,
                user_id=user.id,
                scenario_id=scenario.id,
                status="scored",
                session_type="f2f",
                started_at=started,
                completed_at=completed,
                duration_seconds=duration,
                overall_score=float(overall),
                passed=passed,
                key_messages_status=json.dumps(km_status, ensure_ascii=False),
            )
            session.add(cs)

            # Add conversation messages
            conversation = SAMPLE_CONVERSATIONS[sess_idx % len(SAMPLE_CONVERSATIONS)]
            for msg_idx, (role, content) in enumerate(conversation):
                msg = SessionMessage(
                    id=str(uuid.uuid4()),
                    session_id=cs_id,
                    role=role,
                    content=content,
                    message_index=msg_idx,
                )
                session.add(msg)

            # Determine feedback level based on score
            if overall >= 80:
                fb_level = "high"
            elif overall >= 70:
                fb_level = "mid"
            else:
                fb_level = "low"

            feedback_summary = (
                f"本次训练总分 {overall}/100，"
                + ("达到通过标准。" if passed else "未达到通过标准。")
                + f"共传递了{km_delivered}/{len(key_msgs)}个关键信息。"
            )

            score_id = str(uuid.uuid4())
            ss = SessionScore(
                id=score_id,
                session_id=cs_id,
                overall_score=float(overall),
                passed=passed,
                feedback_summary=feedback_summary,
            )
            session.add(ss)

            # Get scoring weights from rubric dimensions
            weight_list = [25, 20, 20, 20, 15]  # defaults
            if hasattr(scenario, "rubric_id") and scenario.rubric_id:
                try:
                    from app.models.scoring_rubric import ScoringRubric

                    rub_result = await session.execute(
                        select(ScoringRubric).where(ScoringRubric.id == scenario.rubric_id)
                    )
                    rub = rub_result.scalar_one_or_none()
                    if rub:
                        rub_dims = (
                            json.loads(rub.dimensions)
                            if isinstance(rub.dimensions, str)
                            else rub.dimensions
                        )
                        dim_weight_map = {d["name"]: d["weight"] for d in rub_dims}
                        weight_list = [
                            dim_weight_map.get("key_message", 25),
                            dim_weight_map.get("objection_handling", 20),
                            dim_weight_map.get("communication", 20),
                            dim_weight_map.get("product_knowledge", 20),
                            dim_weight_map.get("scientific_info", 15),
                        ]
                except Exception:
                    pass

            for dim_idx, dim_name in enumerate(dimensions):
                # Vary dimension score around overall (+/- 10, clamped 0-100)
                offset = (dim_idx * 5) - 10  # -10, -5, 0, 5, 10
                dim_score = max(0.0, min(100.0, float(overall + offset)))

                # Get rich feedback for this dimension
                fb = DIMENSION_FEEDBACK.get(dim_name, {}).get(fb_level, {})
                sd = ScoreDetail(
                    id=str(uuid.uuid4()),
                    score_id=score_id,
                    dimension=dim_name,
                    score=dim_score,
                    weight=weight_list[dim_idx],
                    strengths=json.dumps(fb.get("strengths", []), ensure_ascii=False),
                    weaknesses=json.dumps(fb.get("weaknesses", []), ensure_ascii=False),
                    suggestions=json.dumps(fb.get("suggestions", []), ensure_ascii=False),
                )
                session.add(sd)

            session_count += 1

    await session.commit()
    print(f"  [created] {session_count} scored sessions with messages, scores, and feedback")


async def seed_azure_config(session: AsyncSession) -> None:
    """Seed ServiceConfig from .env Azure Foundry vars if not already configured.

    Creates master AI Foundry row + voice_live service row with agent mode
    so that agent_sync_service can reach the AI Foundry /assistants API.
    Idempotent — skips if master config already exists.
    """
    from app.utils.encryption import encrypt_value

    # Check if master config already exists
    result = await session.execute(
        select(ServiceConfig).where(ServiceConfig.is_master == True)  # noqa: E712
    )
    if result.scalar_one_or_none() is not None:
        print("  [skip] AI Foundry master config already exists")
        return

    endpoint = settings.azure_foundry_endpoint
    api_key = settings.azure_foundry_api_key
    project = settings.azure_foundry_default_project

    if not endpoint:
        print("  [skip] AZURE_FOUNDRY_ENDPOINT not set in .env — skipping config seed")
        return

    # 1. Master AI Foundry row
    master = ServiceConfig(
        service_name="ai_foundry",
        display_name="Azure AI Foundry",
        endpoint=endpoint,
        api_key_encrypted=encrypt_value(api_key) if api_key else "",
        model_or_deployment=settings.azure_openai_deployment or "gpt-4o",
        region="swedencentral",
        is_master=True,
        is_active=True,
        updated_by="seed",
    )
    session.add(master)
    print(f"  [created] AI Foundry master config (endpoint={endpoint})")

    # 2. Voice Live service row in agent mode with project_name
    if project:
        import json

        mode_json = json.dumps(
            {
                "mode": "agent",
                "agent_id": "",
                "project_name": project,
            }
        )
        vl = ServiceConfig(
            service_name="azure_voice_live",
            display_name="Azure Voice Live",
            endpoint="",  # inherits from master
            api_key_encrypted="",  # inherits from master
            model_or_deployment=mode_json,
            region="",
            is_master=False,
            is_active=True,
            updated_by="seed",
        )
        session.add(vl)
        print(f"  [created] Voice Live config (agent mode, project={project})")

    await session.commit()


async def seed_default_avatar_persona(session: AsyncSession) -> None:
    """Seed exactly one enabled, default AvatarPersona (Phase 36, D-02) so
    the anonymous path never falls back to zero personas. Idempotent --
    skips if any AvatarPersona row already exists. Uses "lisa" (a real
    prebuilt character from AVATAR_VIDEO_CHARACTERS) -- deliberately not
    "jeff" per the documented Dec-2026 retirement pitfall."""
    result = await session.execute(select(func.count()).select_from(AvatarPersona))
    if (result.scalar() or 0) > 0:
        print("  [skip] AvatarPersona rows already exist")
        return

    persona = AvatarPersona(
        name="Lisa",
        character="lisa",
        style="casual-sitting",
        voice_map=json.dumps({"en-US": "en-US-AvaNeural"}),
        greeting_map=json.dumps({"en-US": "Hi, I'm Lisa! How can I help you today?"}),
        prompt_fragment="",
        enabled=True,
        is_default=True,
    )
    session.add(persona)
    await session.commit()
    print("  [created] Default AvatarPersona 'Lisa' (enabled, is_default)")


async def main() -> None:
    """Create seed users, default rubric, and sample sessions."""
    from app.models.base import Base

    engine = create_async_engine(settings.database_url, echo=False)

    # Ensure tables exist before seeding
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with session_factory() as session:
        for user_data in SEED_USERS:
            result = await session.execute(
                select(User).where(User.username == user_data["username"])
            )
            if result.scalar_one_or_none() is not None:
                print(f"  [skip] User '{user_data['username']}' already exists")
                continue

            user = User(
                username=user_data["username"],
                email=user_data["email"],
                hashed_password=get_password_hash(user_data["password"]),
                full_name=user_data["full_name"],
                role=user_data["role"],
                preferred_language=user_data["preferred_language"],
                business_unit=user_data.get("business_unit", ""),
            )
            session.add(user)
            print(f"  [created] User '{user_data['username']}' (role={user_data['role']})")

        await session.commit()

        # Seed default rubric using admin user
        admin_result = await session.execute(select(User).where(User.username == "admin"))
        admin_user = admin_result.scalar_one_or_none()
        if admin_user:
            await seed_default_rubric(session, admin_user.id)
            await session.commit()

        # Seed sample sessions and scores for analytics
        await seed_sessions(session)

        # Seed Azure AI Foundry config from .env (for agent sync)
        await seed_azure_config(session)

        # Seed default AvatarPersona (Phase 36, PERSONA-01/02)
        await seed_default_avatar_persona(session)

    await engine.dispose()
    print("Seed complete.")

    # Also seed training materials
    from scripts.seed_materials import seed_materials

    await seed_materials()


if __name__ == "__main__":
    asyncio.run(main())
