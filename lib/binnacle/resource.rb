require 'json'

module Binnacle
  class Resource
    attr_reader :route
    attr_writer :connection

    def post_asynch
      Thread.new do
        response = response_from_post(@connection, self.route, self.to_json)

        if response.status == 401
          Binnacle.binnacle_logger.error("Error communicating with Binnacle: #{response.body}")
        end
      end
    end

    def post
      response = response_from_post(@connection, self.route, self.to_json)

      if response.status == 401
        Binnacle.binnacle_logger.error("Error communicating with Binnacle: #{response.body}")
      else
        JSON.parse(response.body)
      end
    end

    def self.get(connection, path, query_params)
      response = connection.get do |req|
        req.url path
        req.headers['Content-Type'] = 'application/json'
        query_params.each do |n,v|
          req.params[n] = v if v
        end
      end

      if response.status == 401
        Binnacle.binnacle_logger.error("Error communicating with Binnacle: #{response.body}")
      else
        JSON.parse(response.body).map { |r| self.from_hash(r) }
      end
    end

    protected

    def response_from_post(connection, route, body)
      connection.post do |req|
        req.url route
        req.headers['Content-Type'] = 'application/json'
        req.body = body
      end
    end
  end
end
