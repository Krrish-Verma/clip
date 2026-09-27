FROM maven:3.9.11-eclipse-temurin-21 AS build
WORKDIR /workspace
COPY pom.xml .
RUN mvn -q -DskipTests dependency:go-offline
COPY src src
RUN mvn -q -DskipTests package

FROM eclipse-temurin:21-jre-noble
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg wget && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build /workspace/target/clip-api-0.1.0.jar /app/app.jar
RUN useradd --system --uid 10001 clip
USER clip
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
