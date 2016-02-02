unless ENV['RAILS_ENV'] == 'test'
  module Net
    class HTTP
      alias_method(:orig_request, :request) unless method_defined?(:orig_request)

      def request(req, body = nil, &block)
        url = "http://#{@address}:#{@port}#{req.path}"
        uri = URI(url)
        url_without_query = "#{uri.scheme}://#{uri.host}:#{uri.port}#{uri.path}"

        bm = Benchmark.realtime do
          @response = orig_request(req, body, &block)
        end

        if Binnacle::HttpLogger.allow?(url) && started?
          data = req.body.nil? || req.body.size == 0 ? body : req.body
          Binnacle::HttpLogger.signal(url_without_query, req.method, @address, @port, uri.path, uri.query, @response.code, bm, @response.each_header.collect.to_h, @response.body, @response['Content-Encoding'], @response['Content-Type'], data)
        end

        @response
      end
    end
  end
end

#
# Adapt the adapter to allow for testing..
#
if ENV['RAILS_ENV'] == 'test' #defined?(Webmock) &&
  require 'webmock'
  web_mock_adapter = WebMock::HttpLibAdapters::NetHttpAdapter.instance_variable_get("@webMockNetHTTP")
  web_mock_adapter.send(:alias_method, :orig_request, :request) unless web_mock_adapter.method_defined?(:orig_request)
  web_mock_adapter.send(:define_method, :request, lambda do |req, body = nil, &block|
    url = "http://#{@address}:#{@port}#{req.path}"
    
    return orig_request(req, body, &block) unless Binnacle::HttpLogger.allow?(url)

    uri = URI(url)
    url_without_query = "#{uri.scheme}://#{uri.host}:#{uri.port}#{uri.path}"

    bm = Benchmark.realtime do
      @response = orig_request(req, body, &block)
    end

    if Binnacle::HttpLogger.allow?(url)
      data = req.body.nil? || req.body.size == 0 ? body : req.body
      headers = @response.each_header.collect.to_h
      Binnacle::HttpLogger.signal(url_without_query, req.method, @address, @port, uri.path, uri.query, @response.code, bm, headers, @response.body, @response['Content-Encoding'], @response['Content-Type'], data)
    end

    @response
  end
  )
end
