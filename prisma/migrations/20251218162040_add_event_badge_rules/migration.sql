-- CreateTable
CREATE TABLE "event_badge_rules" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "badge_template_id" UUID NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_badge_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_badge_rule_attendee_types" (
    "rule_id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "attendee_type_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_badge_rule_attendee_types_pkey" PRIMARY KEY ("rule_id","attendee_type_id")
);

-- CreateIndex
CREATE INDEX "event_badge_rules_org_id_event_id_idx" ON "event_badge_rules"("org_id", "event_id");

-- CreateIndex
CREATE INDEX "event_badge_rules_badge_template_id_idx" ON "event_badge_rules"("badge_template_id");

-- CreateIndex
CREATE UNIQUE INDEX "event_badge_rules_event_id_org_id_priority_key" ON "event_badge_rules"("event_id", "org_id", "priority");

-- CreateIndex
CREATE INDEX "event_badge_rule_attendee_types_org_id_rule_id_idx" ON "event_badge_rule_attendee_types"("org_id", "rule_id");

-- CreateIndex
CREATE INDEX "event_badge_rule_attendee_types_attendee_type_id_idx" ON "event_badge_rule_attendee_types"("attendee_type_id");

-- AddForeignKey
ALTER TABLE "event_badge_rules" ADD CONSTRAINT "event_badge_rules_event_id_org_id_fkey" FOREIGN KEY ("event_id", "org_id") REFERENCES "events"("id", "org_id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "event_badge_rules" ADD CONSTRAINT "event_badge_rules_badge_template_id_org_id_fkey" FOREIGN KEY ("badge_template_id", "org_id") REFERENCES "badge_templates"("id", "org_id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "event_badge_rule_attendee_types" ADD CONSTRAINT "event_badge_rule_attendee_types_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "event_badge_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_badge_rule_attendee_types" ADD CONSTRAINT "event_badge_rule_attendee_types_attendee_type_id_org_id_fkey" FOREIGN KEY ("attendee_type_id", "org_id") REFERENCES "attendee_types"("id", "org_id") ON DELETE CASCADE ON UPDATE NO ACTION;
