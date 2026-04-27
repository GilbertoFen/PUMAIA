-- CreateTable
CREATE TABLE "SchoolarshipUser" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "schoolarshipId" TEXT NOT NULL,

    CONSTRAINT "SchoolarshipUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Schoolarship" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,

    CONSTRAINT "Schoolarship_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SchoolarshipUser_userId_schoolarshipId_key" ON "SchoolarshipUser"("userId", "schoolarshipId");

-- AddForeignKey
ALTER TABLE "SchoolarshipUser" ADD CONSTRAINT "SchoolarshipUser_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolarshipUser" ADD CONSTRAINT "SchoolarshipUser_schoolarshipId_fkey" FOREIGN KEY ("schoolarshipId") REFERENCES "Schoolarship"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Schoolarship" ADD CONSTRAINT "Schoolarship_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
